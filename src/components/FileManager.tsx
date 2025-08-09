import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';
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
  const [folderName, setFolderName] = useState('');
  const [binFiles, setBinFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ======================
  // CURRENTLY USING PUBLIC BUCKET
  // FOR TESTING - CHANGE TO PROTECTED IN PRODUCTION
  // ======================
  const accessLevel = 'guest'; // Change to 'protected' for production
  const getFileUrl = async (key: string) => {
    if (accessLevel === 'guest') {
      return `https://adler-personal-storage.s3.ap-south-1.amazonaws.com/${key}`;
    }
    const { url } = await getUrl({ key, options: { accessLevel } });
    return url;
  };

  useEffect(() => {
    fetchFiles();
    fetchBinFiles();
  }, []);

  const apiCall = async (path: string, method = 'GET', options = {}) => {
    try {
      const user = await getCurrentUser();
      const response = await get({
        apiName: 'CV_v1',
        path: path,
        options: {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`
          },
          ...options
        }
      }).response;
      return await response.body.json();
    } catch (error: any) {
      onMessage(`API call failed: ${error.message}`);
      throw error;
    }
  };

  const fetchFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=list&user=${user.username}`);
      setFiles(response?.files || []);
    } catch (error) {
      onMessage(`Failed to fetch files: ${(error as Error).message}`);
    }
  };

  const fetchBinFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=list&user=${user.username}&prefix=bin`);
      setBinFiles(response?.files || []);
    } catch (error) {
      onMessage(`Failed to fetch bin: ${(error as Error).message}`);
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) {
      onMessage('Folder name cannot be empty');
      return;
    }
    
    setLoading(true);
    try {
      await apiCall(`/file?action=create_folder&file=${encodeURIComponent(folderName)}`, 'POST');
      onMessage(`Folder "${folderName}" created`);
      setFolderName('');
      fetchFiles();
    } catch (error) {
      onMessage(`Folder creation failed: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      
      await Promise.all(acceptedFiles.map(async (file) => {
        const fileKey = accessLevel === 'protected' 
          ? `${user.username}/${file.name}`
          : file.name;

        await uploadData({
          key: fileKey,
          data: file,
          options: {
            accessLevel,
            contentType: file.type || 'application/octet-stream'
          }
        }).result;
      }));

      onMessage(`Uploaded ${acceptedFiles.length} file(s)`);
      fetchFiles();
    } catch (error) {
      console.error('Upload error:', error);
      onMessage(`Upload failed: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      onMessage(`Download failed: ${(error as Error).message}`);
    }
  };

  const handleMultipleDownload = async () => {
    if (selectedFiles.length === 0) return;
    
    setLoading(true);
    try {
      const zip = new JSZip();
      const user = await getCurrentUser();

      await Promise.all(selectedFiles.map(async (fileKey) => {
        const url = await getFileUrl(
          accessLevel === 'protected'
            ? `${user.username}/${fileKey}`
            : fileKey
        );
        const response = await fetch(url);
        zip.file(fileKey, await response.blob());
      }));

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'download.zip';
      link.click();
      setSelectedFiles([]);
    } catch (error) {
      onMessage(`Download failed: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const moveToBin = async (fileKey: string) => {
    try {
      await apiCall(`/bin?action=move_to_bin&file=${encodeURIComponent(fileKey)}`, 'POST');
      fetchFiles();
      fetchBinFiles();
    } catch (error) {
      onMessage(`Move failed: ${(error as Error).message}`);
    }
  };

  const restoreFromBin = async (fileKey: string) => {
    try {
      await apiCall(`/bin?action=restore_from_bin&file=${encodeURIComponent(fileKey)}`, 'POST');
      fetchFiles();
      fetchBinFiles();
    } catch (error) {
      onMessage(`Restore failed: ${(error as Error).message}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    disabled: loading,
    multiple: true
  });

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">CloudVault</h1>
            <p className="text-gray-600">
              {accessLevel === 'guest' 
                ? "PUBLIC MODE - For testing only" 
                : "Secure cloud storage"}
            </p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              onAuthChange();
            }}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {accessLevel === 'guest' && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6">
            <p className="text-yellow-700">
              ⚠️ Warning: Your bucket is in public mode. Switch to protected access for production.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Files Section */}
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Upload className="w-6 h-6" />
              My Files
            </h2>
            
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="New folder name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={createFolder}
                disabled={loading || !folderName.trim()}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <FolderPlus className="w-4 h-4" />
                Create
              </button>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
              } ${loading ? 'opacity-70' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-900 font-medium mb-2">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-gray-500 text-sm">
                or click to browse files
              </p>
            </div>

            <div className="mt-6 space-y-2 max-h-96 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFiles([...selectedFiles, file]);
                        } else {
                          setSelectedFiles(selectedFiles.filter(f => f !== file));
                        }
                      }}
                      className="w-4 h-4 text-blue-500"
                    />
                    <span className="text-gray-900 truncate">{file}</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveToBin(file)}
                      className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-gray-500 text-center py-8">No files found</p>
              )}
            </div>

            <button
              onClick={handleMultipleDownload}
              disabled={selectedFiles.length === 0 || loading}
              className="w-full mt-4 bg-indigo-500 text-white py-3 rounded-lg hover:bg-indigo-600 disabled:opacity-50"
            >
              Download Selected ({selectedFiles.length})
            </button>
          </div>

          {/* Bin Section */}
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              Recycle Bin
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Files will be automatically deleted after 30 days
            </p>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {binFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <span className="text-gray-900 truncate flex-1">{file}</span>
                  <button
                    onClick={() => restoreFromBin(file)}
                    className="p-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {binFiles.length === 0 && (
                <p className="text-gray-500 text-center py-8">Bin is empty</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;