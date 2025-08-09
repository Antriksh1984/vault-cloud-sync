import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';
import { get, post } from 'aws-amplify/api';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { Upload, Download, Trash2, FolderPlus, RotateCcw, LogOut } from 'lucide-react';

interface FileManagerProps {
  onMessage: (text: string) => void;
  onAuthChange: () => void;
}

const FileManager = ({ onMessage, onAuthChange }: FileManagerProps) => {
  const [files, setFiles] = useState<string[]>([]);
  const [folderName, setFolderName] = useState('');
  const [binFiles, setBinFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // For testing — set to "guest". For production, use "protected".
  const accessLevel = 'guest';

  // ===== Helper: Get file URL =====
  const getFileUrl = async (key: string) => {
    if (accessLevel === 'guest') {
      return `https://adler-personal-storage.s3.ap-south-1.amazonaws.com/${key}`;
    }
    const { url } = await getUrl({ key, options: { accessLevel } });
    return url;
  };

  // ===== Helper: API call with auth token =====
  const apiCall = async (path: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const apiFn = method === 'GET' ? get : post;
      const response = await apiFn({
        apiName: 'CV_v1',
        path,
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
      console.error(`API ${method} ${path} failed:`, error);
      throw error;
    }
  };

  // ===== Fetch My Files =====
  const fetchFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=list&user=${user.username}`);
      setFiles(response?.files || []);
    } catch (error: any) {
      onMessage(`Failed to fetch files: ${error.message}`);
    }
  };

  // ===== Fetch Bin =====
  const fetchBinFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=list&user=${user.username}&prefix=bin`);
      setBinFiles(response?.files || []);
    } catch (error: any) {
      onMessage(`Failed to fetch bin: ${error.message}`);
    }
  };

  // ===== Create Folder =====
  const createFolder = async () => {
    if (!folderName.trim()) return onMessage('Folder name cannot be empty');
    setLoading(true);
    try {
      await apiCall(`/file?action=create_folder&file=${encodeURIComponent(folderName)}`, 'POST');
      onMessage(`Folder "${folderName}" created`);
      setFolderName('');
      fetchFiles();
    } catch (error: any) {
      onMessage(`Folder creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== Upload =====
  const handleUpload = async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const user = await getCurrentUser();

      await Promise.all(
        acceptedFiles.map(async (file) => {
          const fileKey =
            accessLevel === 'protected' ? `${user.username}/${file.name}` : file.name;

          await uploadData({
            key: fileKey,
            data: file,
            options: {
              accessLevel,
              contentType: file.type || 'application/octet-stream'
            }
          }).result;
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

  // ===== Download Single =====
  const handleDownload = async (fileKey: string) => {
    try {
      const url = await getFileUrl(
        accessLevel === 'protected'
          ? `${(await getCurrentUser()).username}/${fileKey}`
          : fileKey
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = fileKey;
      link.click();
    } catch (error: any) {
      onMessage(`Download failed: ${error.message}`);
    }
  };

  // ===== Download Multiple =====
  const handleMultipleDownload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    try {
      const zip = new JSZip();
      const user = await getCurrentUser();

      await Promise.all(
        selectedFiles.map(async (fileKey) => {
          const url = await getFileUrl(
            accessLevel === 'protected'
              ? `${user.username}/${fileKey}`
              : fileKey
          );
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

  // ===== Move to Bin =====
  const moveToBin = async (fileKey: string) => {
    try {
      await apiCall(`/bin?action=move_to_bin&file=${encodeURIComponent(fileKey)}`, 'POST');
      fetchFiles();
      fetchBinFiles();
    } catch (error: any) {
      onMessage(`Move failed: ${error.message}`);
    }
  };

  // ===== Restore from Bin =====
  const restoreFromBin = async (fileKey: string) => {
    try {
      await apiCall(`/bin?action=restore_from_bin&file=${encodeURIComponent(fileKey)}`, 'POST');
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
