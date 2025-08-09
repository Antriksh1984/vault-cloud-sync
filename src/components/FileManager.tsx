import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { uploadData } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { Upload, Download, Trash2, FolderPlus, RotateCcw, LogOut, DownloadCloud } from 'lucide-react';

interface FileManagerProps {
  onAuthChange: () => void;
}

interface FileItem {
  key: string;
}

const MessageBox: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
      <p className="text-gray-800 mb-4">{message}</p>
      <button
        onClick={onClose}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-600"
      >
        OK
      </button>
    </div>
  </div>
);

const FileManager: React.FC<FileManagerProps> = ({ onAuthChange }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [binFiles, setBinFiles] = useState<FileItem[]>([]);
  const [folderName, setFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const accessLevel = 'private';

  // Helper: API call with auth token
  const apiCall = async (path: string, body: any = {}) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error('Authentication token is missing.');
      const response = await post({
        apiName: 'CV_v1',
        path,
        options: {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body,
        },
      }).response;
      return await response.body.json();
    } catch (error: any) {
      throw new Error(error.message || 'API call failed.');
    }
  };

  // Fetch My Files
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/list');
      setFiles(response.files || []);
    } catch (error: any) {
      setMessage(`Failed to fetch files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Bin
  const fetchBinFiles = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/list_bin');
      setBinFiles(response.files || []);
    } catch (error: any) {
      setMessage(`Failed to fetch bin: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create Folder
  const createFolder = async () => {
    if (!folderName.trim()) {
      setMessage('Folder name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      await apiCall('/create_folder', { folderName });
      setMessage(`Folder "${folderName}" created.`);
      setFolderName('');
      await fetchFiles();
    } catch (error: any) {
      setMessage(`Folder creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Upload Files
  const handleUpload = async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      await Promise.all(
        acceptedFiles.map(async (file) => {
          const fileKey = `public/${user.userId}/${file.webkitRelativePath || file.name}`;
          await uploadData({
            key: fileKey,
            data: file,
            options: {
              accessLevel,
              contentType: file.type || 'application/octet-stream',
            },
          }).result;
        })
      );
      setMessage(`Uploaded ${acceptedFiles.length} file(s).`);
      await fetchFiles();
    } catch (error: any) {
      setMessage(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Download Single File
  const handleDownload = async (fileKey: string) => {
    setLoading(true);
    try {
      const response = await apiCall('/get_file', { fileKey });
      const link = document.createElement('a');
      link.href = response.url;
      link.download = fileKey.split('/').pop() || fileKey;
      link.click();
      setMessage('File downloaded successfully.');
    } catch (error: any) {
      setMessage(`Download failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Download Multiple Files
  const handleMultipleDownload = async () => {
    if (selectedFiles.length === 0) {
      setMessage('Please select at least one file.');
      return;
    }
    setLoading(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        selectedFiles.map(async (fileKey) => {
          const response = await apiCall('/get_file', { fileKey });
          const res = await fetch(response.url);
          zip.file(fileKey.split('/').pop() || fileKey, await res.blob());
        })
      );
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'CloudVault_Download.zip';
      link.click();
      setMessage('Files downloaded as ZIP.');
      setSelectedFiles([]);
    } catch (error: any) {
      setMessage(`Download failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Move to Bin
  const moveToBin = async (fileKey: string) => {
    setLoading(true);
    try {
      await apiCall('/move_to_bin', { fileKey });
      setMessage('File moved to bin.');
      await Promise.all([fetchFiles(), fetchBinFiles()]);
    } catch (error: any) {
      setMessage(`Move failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Restore from Bin
  const restoreFromBin = async (fileKey: string) => {
    setLoading(true);
    try {
      await apiCall('/restore_from_bin', { fileKey });
      setMessage('File restored successfully.');
      await Promise.all([fetchFiles(), fetchBinFiles()]);
    } catch (error: any) {
      setMessage(`Restore failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    disabled: loading,
  });

  useEffect(() => {
    fetchFiles();
    fetchBinFiles();
  }, []);

  return (
    <div className="min-h-screen max-w-7xl mx-auto p-6 bg-gray-50 font-inter">
      {message && <MessageBox message={message} onClose={() => setMessage('')} />}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-25">
          <div className="bg-white p-4 rounded-lg shadow-xl">Loading...</div>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">CloudVault</h1>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await signOut();
              onAuthChange();
            } catch (error: any) {
              setMessage(`Sign out failed: ${error.message}`);
            } finally {
              setLoading(false);
            }
          }}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors focus:ring-2 focus:ring-red-600"
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
          className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-600"
          disabled={loading}
        />
        <button
          onClick={createFolder}
          disabled={loading || !folderName.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 focus:ring-2 focus:ring-blue-600"
        >
          <FolderPlus className="inline w-4 h-4 mr-1" /> Create
        </button>
      </div>

      {/* File Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-6 text-center mb-6 ${
          isDragActive ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto w-12 h-12 text-gray-400 mb-2" />
        <p className="text-gray-600">Drag & drop files or folders here, or click to select</p>
      </div>

      {/* Multi-Download Button */}
      {selectedFiles.length > 0 && (
        <button
          onClick={handleMultipleDownload}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md mb-6 hover:bg-indigo-700 transition-colors disabled:opacity-50 focus:ring-2 focus:ring-indigo-600"
        >
          <DownloadCloud className="inline w-4 h-4 mr-1" /> Download Selected ({selectedFiles.length})
        </button>
      )}

      {/* Files List */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">My Files</h2>
        {files.length === 0 ? (
          <p className="text-gray-500">No files found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {files.map((file) => (
              <div key={file.key} className="bg-white p-4 rounded-md shadow-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.key)}
                  onChange={() =>
                    setSelectedFiles((prev) =>
                      prev.includes(file.key) ? prev.filter((k) => k !== file.key) : [...prev, file.key]
                    )
                  }
                  disabled={loading}
                  className="h-4 w-4"
                />
                <span className="text-gray-800 flex-1">{file.key.split('/').pop()}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(file.key)}
                    disabled={loading}
                    className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 focus:ring-2 focus:ring-blue-600"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveToBin(file.key)}
                    disabled={loading}
                    className="bg-red-600 text-white p-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 focus:ring-2 focus:ring-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bin */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recycle Bin</h2>
        {binFiles.length === 0 ? (
          <p className="text-gray-500">Bin is empty</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {binFiles.map((file) => (
              <div key={file.key} className="bg-white p-4 rounded-md shadow-sm flex items-center gap-2">
                <span className="text-gray-800 flex-1">{file.key.split('/').pop()}</span>
                <button
                  onClick={() => restoreFromBin(file.key)}
                  disabled={loading}
                  className="bg-yellow-500 text-white p-2 rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50 focus:ring-2 focus:ring-yellow-500"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileManager;