import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { get } from 'aws-amplify/api';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { Upload, Download, Trash2, FolderPlus, RotateCcw, LogOut } from 'lucide-react';

interface FileManagerProps {
  onMessage: (text: string) => void;
  onAuthChange: () => void;
}

const FileManager = ({ onMessage, onAuthChange }: FileManagerProps) => {
  const [files, setFiles] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folderName, setFolderName] = useState('');
  const [binFiles, setBinFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper: Clean file key for display (remove public/{user_id}/ prefix)
  const cleanFileKey = (key: string, userId: string) => {
    const prefix = `public/${userId}/`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  };

  // Helper: Clean bin file key for display (remove public/{user_id}/bin/ prefix)
  const cleanBinFileKey = (key: string, userId: string) => {
    const prefix = `public/${userId}/bin/`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  };

  // Helper: API call with auth token
  const apiCall = async (
    action: string,
    fileKey?: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    retries = 2
  ) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        if (retries > 0) {
          console.warn(`No auth token yet. Retrying API call: ${action}`);
          await new Promise((res) => setTimeout(res, 1000));
          return apiCall(action, fileKey, method, body, retries - 1);
        }
        throw new Error('Auth token missing after retries — likely Cognito session not ready.');
      }

      const queryParams = new URLSearchParams({ action });
      if (fileKey) {
        queryParams.append('file', encodeURIComponent(fileKey));
      }

      const response = await get({
        apiName: 'CV_v1',
        path: `/file?${queryParams.toString()}`,
        options: {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          ...(body ? { body } : {})
        }
      }).response;

      return await response.body.json();
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch')) {
        throw new Error(
          'Network/CORS error — API Gateway might be missing CORS headers or OPTIONS method.'
        );
      }
      throw error;
    }
  };

  // Fetch My Files and Folders
  const fetchFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall('list');
      setFiles((response?.files || []).map((key: string) => cleanFileKey(key, user.username)));
      setFolders((response?.folders || []).map((key: string) => cleanFileKey(key, user.username)));
    } catch (error: any) {
      onMessage(`Failed to fetch files: ${error.message}`);
    }
  };

  // Fetch Bin
  const fetchBinFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall('list', 'bin/');
      setBinFiles((response?.files || []).map((key: string) => cleanBinFileKey(key, user.username)));
    } catch (error: any) {
      onMessage(`Failed to fetch bin: ${error.message}`);
    }
  };

  // Create Folder
  const createFolder = async () => {
    if (!folderName.trim()) return onMessage('Folder name cannot be empty');
    setLoading(true);
    try {
      await apiCall('create_folder', folderName, 'POST');
      onMessage(`Folder "${folderName}" created`);
      setFolderName('');
      fetchFiles();
    } catch (error: any) {
      onMessage(`Folder creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Upload
  const handleUpload = async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      await Promise.all(
        acceptedFiles.map(async (file) => {
          const fileKey = `${file.name}`;
          const response = await apiCall('generate_upload_url', fileKey);
          const { uploadURL } = response;

          await fetch(uploadURL, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file
          });
        })
      );
      onMessage(`Uploaded ${acceptedFiles.length} file(s)`);
      fetchFiles();
    } catch (error: any) {
      onMessage(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Download Single
  const handleDownload = async (fileKey: string) => {
    try {
      const response = await apiCall('get_file', fileKey);
      const link = document.createElement('a');
      link.href = response;
      link.download = fileKey;
      link.click();
    } catch (error: any) {
      onMessage(`Download failed: ${error.message}`);
    }
  };

  // Download Multiple
  const handleMultipleDownload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        selectedFiles.map(async (fileKey) => {
          const url = await apiCall('get_file', fileKey);
          const response = await fetch(url);
          zip.file(fileKey, await response.blob());
        })
      );
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'download.zip';
      link.click();
    } catch (error: any) {
      onMessage(`Download failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Move to Bin
  const moveToBin = async (fileKey: string) => {
    try {
      await apiCall('move_to_bin', fileKey, 'POST');
      onMessage(`Moved "${fileKey}" to bin`);
      fetchFiles();
      fetchBinFiles();
    } catch (error: any) {
      onMessage(`Move failed: ${error.message}`);
    }
  };

  // Restore from Bin
  const restoreFromBin = async (fileKey: string) => {
    try {
      await apiCall('restore_from_bin', `bin/${fileKey}`, 'POST');
      onMessage(`Restored "${fileKey}" from bin`);
      fetchFiles();
      fetchBinFiles();
    } catch (error: any) {
      onMessage(`Restore failed: ${error.message}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    disabled: loading
  });

  useEffect(() => {
    fetchFiles();
    fetchBinFiles();
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">CloudVault</h1>
        <button
          onClick={async () => {
            await signOut();
            onAuthChange();
          }}
          className="bg-red-500 text-white px-4 py-2 rounded-lg"
        >
          <LogOut className="inline w-4 h-4 mr-1" /> Sign Out
        </button>
      </div>

      {/* Create Folder */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="New folder name"
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <button
          onClick={createFolder}
          disabled={loading || !folderName.trim()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          <FolderPlus className="inline w-4 h-4 mr-1" /> Create
        </button>
      </div>

      {/* File Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto w-12 h-12 text-gray-400 mb-2" />
        <p>Drag & drop files here or click to browse</p>
      </div>

      {/* Folders List */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">My Folders</h2>
        {folders.length === 0 ? (
          <p className="text-gray-500">No folders found</p>
        ) : (
          folders.map((folder) => (
            <div key={folder} className="flex justify-between items-center bg-white p-2 border rounded mb-1">
              <span>{folder}</span>
            </div>
          ))
        )
      }

      {/* Files List */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">My Files</h2>
        {files.length === 0 ? (
          <p className="text-gray-500">No files found</p>
        ) : (
          files.map((file) => (
            <div key={file} className="flex justify-between items-center bg-white p-2 border rounded mb-1">
              <span>{file}</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(file)} className="bg-green-500 p-2 rounded text-white">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => moveToBin(file)} className="bg-red-500 p-2 rounded text-white">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bin */}
      <div className="mt-8">
        <h2 className="font-semibold mb-2">Recycle Bin</h2>
        {binFiles.length === 0 ? (
          <p className="text-gray-500">Bin is empty</p>
        ) : (
          binFiles.map((file) => (
            <div key={file} className="flex justify-between items-center bg-white p-2 border rounded mb-1">
              <span>{file}</span>
              <button onClick={() => restoreFromBin(file)} className="bg-yellow-500 p-2 rounded text-white">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileManager;