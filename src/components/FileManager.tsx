import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { get, post } from 'aws-amplify/api';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { Upload, Download, Trash2, FolderPlus, RotateCcw, LogOut, Folder } from 'lucide-react';

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
  const [currentPath, setCurrentPath] = useState('');

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
        throw new Error('Authentication token missing after retries.');
      }

      const queryParams = new URLSearchParams({ action });
      if (fileKey) {
        queryParams.append('file', encodeURIComponent(fileKey));
      }
      if (body?.contentType) {
        queryParams.append('contentType', encodeURIComponent(body.contentType));
      }

      const apiFn = method === 'GET' ? get : post;
      const response = await apiFn({
        apiName: 'CV_v1',
        path: `/file?${queryParams.toString()}`,
        options: {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          ...(body && method === 'POST' ? { body } : {})
        }
      }).response;

      const data = await response.body.json();
      if (response.statusCode >= 400) {
        throw new Error(data || 'API request failed');
      }
      return data;
    } catch (error: any) {
      console.error('API call error:', error);
      throw new Error(error.message || 'Failed to communicate with the server. Please check your network or API configuration.');
    }
  };

  // Fetch Files and Folders
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      const response = await apiCall('list', currentPath);
      setFiles((response?.files || []).map((key: string) => cleanFileKey(key, user.username)));
      setFolders((response?.folders || []).map((key: string) => cleanFileKey(key, user.username)));
    } catch (error: any) {
      onMessage(`Failed to fetch files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Bin
  const fetchBinFiles = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      const response = await apiCall('list', 'bin/');
      setBinFiles((response?.files || []).map((key: string) => cleanBinFileKey(key, user.username)));
    } catch (error: any) {
      onMessage(`Failed to fetch bin: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create Folder
  const createFolder = async () => {
    if (!folderName.trim()) return onMessage('Folder name cannot be empty');
    setLoading(true);
    try {
      const folderPath = currentPath ? `${currentPath}${folderName}` : folderName;
      await apiCall('create_folder', folderPath, 'POST');
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
          const fileKey = currentPath ? `${currentPath}${file.name}` : file.name;
          const response = await apiCall('generate_upload_url', fileKey, 'GET', {
            contentType: file.type || 'application/octet-stream'
          });
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
      const downloadKey = currentPath ? `${currentPath}${fileKey}` : fileKey;
      const response = await apiCall('get_file', downloadKey);
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
    if (selectedFiles.length === 0) {
      onMessage('No files selected for download');
      return;
    }
    setLoading(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        selectedFiles.map(async (fileKey) => {
          const downloadKey = currentPath ? `${currentPath}${fileKey}` : fileKey;
          const url = await apiCall('get_file', downloadKey);
          const response = await fetch(url);
          zip.file(fileKey, await response.blob());
        })
      );
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'download.zip';
      link.click();
      onMessage(`Downloaded ${selectedFiles.length} file(s)`);
      setSelectedFiles([]);
    } catch (error: any) {
      onMessage(`Download failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Move to Bin
  const moveToBin = async (fileKey: string) => {
    try {
      const moveKey = currentPath ? `${currentPath}${fileKey}` : fileKey;
      await apiCall('move_to_bin', moveKey, 'POST');
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

  // Navigate into Folder
  const navigateToFolder = (folder: string) => {
    setCurrentPath((prev) => (prev ? `${prev}${folder}` : folder));
  };

  // Navigate Up
  const navigateUp = () => {
    setCurrentPath((prev) => {
      const parts = prev.split('/').filter(Boolean);
      parts.pop();
      return parts.length > 0 ? `${parts.join('/')}/` : '';
    });
  };

  // Handle File Selection
  const toggleFileSelection = (fileKey: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileKey)
        ? prev.filter((key) => key !== fileKey)
        : [...prev, fileKey]
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    disabled: loading
  });

  useEffect(() => {
    const initialize = async () => {
      try {
        await getCurrentUser();
        await Promise.all([fetchFiles(), fetchBinFiles()]);
      } catch (error) {
        onMessage('Please sign in to access files');
        onAuthChange();
      }
    };
    initialize();
  }, [currentPath]);

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

      {/* Navigation */}
      <div className="mb-4">
        <h2 className="font-semibold">Current Path: {currentPath || '/'}</h2>
        {currentPath && (
          <button
            onClick={navigateUp}
            className="text-blue-500 hover:underline"
          >
            Go Up
          </button>
        )}
      </div>

      {/* Create Folder */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="New folder name"
          className="flex-1 px-4 py-2 border rounded-lg"
          disabled={loading}
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

      {/* Multiple Download Button */}
      <div className="mt-4">
        <button
          onClick={handleMultipleDownload}
          disabled={loading || selectedFiles.length === 0}
          className="bg-purple-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          <Download className="inline w-4 h-4 mr-1" /> Download Selected ({selectedFiles.length})
        </button>
      </div>

      {/* Folders List */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">My Folders</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : folders.length === 0 ? (
          <p className="text-gray-500">No folders found</p>
        ) : (
          folders.map((folder) => (
            <div
              key={folder}
              className="flex justify-between items-center bg-white p-2 border rounded mb-1 cursor-pointer hover:bg-gray-100"
              onClick={() => navigateToFolder(folder)}
            >
              <span>
                <Folder className="inline w-4 h-4 mr-2" />
                {folder}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Files List */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">My Files</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : files.length === 0 ? (
          <p className="text-gray-500">No files found</p>
        ) : (
          files.map((file) => (
            <div
              key={file}
              className={`flex justify-between items-center bg-white p-2 border rounded mb-1 ${
                selectedFiles.includes(file) ? 'bg-blue-100' : ''
              }`}
            >
              <div>
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file)}
                  onChange={() => toggleFileSelection(file)}
                  className="mr-2"
                />
                <span>{file}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(file)}
                  className="bg-green-500 p-2 rounded text-white"
                  disabled={loading}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveToBin(file)}
                  className="bg-red-500 p-2 rounded text-white"
                  disabled={loading}
                >
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
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : binFiles.length === 0 ? (
          <p className="text-gray-500">Bin is empty</p>
        ) : (
          binFiles.map((file) => (
            <div
              key={file}
              className="flex justify-between items-center bg-white p-2 border rounded mb-1"
            >
              <span>{file}</span>
              <button
                onClick={() => restoreFromBin(file)}
                className="bg-yellow-500 p-2 rounded text-white"
                disabled={loading}
              >
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