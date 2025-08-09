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

  useEffect(() => {
    fetchFiles();
    fetchBinFiles();
  }, []);

  const apiCall = async (path: string, method = 'GET', options = {}): Promise<any> => {
    try {
      const user = await getCurrentUser();
      const response = await get({
        apiName: 'CV_v1',
        path: path,
        options: {
          headers: {
            'Content-Type': 'application/json'
          },
          ...options
        }
      }).response;
      const result = await response.body.json();
      return result as any;
    } catch (error: any) {
      onMessage(`API call failed: ${error.message}`);
      return null;
    }
  };

  const fetchFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=list&user=${user.username}`);
      setFiles(response?.files || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchBinFiles = async () => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=list&user=${user.username}&prefix=bin`);
      setBinFiles(response?.files || []);
    } catch (error) {
      console.error('Error fetching bin files:', error);
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) {
      onMessage('Please enter a folder name.');
      return;
    }
    
    setLoading(true);
    try {
      await apiCall(`/file?action=create_folder&file=${folderName}`, 'POST');
      onMessage('Folder created successfully!');
      setFolderName('');
      fetchFiles();
    } catch (error) {
      onMessage('Failed to create folder.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      const uploadPromises = acceptedFiles.map(file => {
        const filePath = (file as any).webkitRelativePath || file.name;
        return uploadData({
          key: `public/${user.username}/${filePath}`,
          data: file
        }).result;
      });
      await Promise.all(uploadPromises);
      onMessage(`${acceptedFiles.length} file(s) uploaded successfully!`);
      fetchFiles();
    } catch (error) {
      onMessage('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileKey: string) => {
    try {
      const user = await getCurrentUser();
      const response = await apiCall(`/file?action=get_file&file=${fileKey}&user=${user.username}`);
      if (response && response.url) {
        const link = document.createElement('a');
        link.href = response.url;
        link.download = fileKey;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onMessage('Download started!');
      } else {
        onMessage('Failed to get download URL.');
      }
    } catch (error) {
      onMessage('Download failed.');
    }
  };

  const handleMultipleDownload = async () => {
    if (selectedFiles.length === 0) {
      onMessage('Please select files to download.');
      return;
    }

    setLoading(true);
    try {
      const zip = new JSZip();
      const user = await getCurrentUser();
      
      const fetchPromises = selectedFiles.map(async fileKey => {
        const response = await apiCall(`/file?action=get_file&file=${fileKey}&user=${user.username}`);
        if (response && response.url) {
          const urlResponse = await fetch(response.url);
          const blob = await urlResponse.blob();
          zip.file(fileKey, blob);
        }
      });

      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'CloudVault_Download.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onMessage('Selected files downloaded as ZIP!');
      setSelectedFiles([]);
    } catch (error) {
      onMessage('Multiple download failed.');
    } finally {
      setLoading(false);
    }
  };

  const moveToBin = async (fileKey: string) => {
    try {
      await apiCall(`/bin?action=move_to_bin&file=${fileKey}`, 'POST');
      onMessage('File moved to bin.');
      fetchFiles();
      fetchBinFiles();
    } catch (error) {
      onMessage('Failed to move file to bin.');
    }
  };

  const restoreFromBin = async (fileKey: string) => {
    try {
      await apiCall(`/bin?action=restore_from_bin&file=${fileKey}`, 'POST');
      onMessage('File restored from bin.');
      fetchFiles();
      fetchBinFiles();
    } catch (error) {
      onMessage('Failed to restore file.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onAuthChange();
    } catch (error) {
      onMessage('Error signing out.');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop: handleUpload,
    multiple: true
  });

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">CloudVault</h1>
            <p className="text-muted-foreground">Secure cloud storage for your files</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Files Section */}
          <div className="bg-card rounded-xl p-6 shadow-xl border border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <Upload className="w-6 h-6" />
              My Files
            </h2>
            
            {/* Create Folder */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="New folder name"
                className="flex-1 px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
              />
              <button
                onClick={createFolder}
                disabled={loading}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <FolderPlus className="w-4 h-4" />
                Create
              </button>
            </div>

            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground font-medium mb-2">
                {isDragActive ? 'Drop files here' : 'Drag & drop files or folders'}
              </p>
              <p className="text-muted-foreground text-sm">
                or click to select files
              </p>
            </div>

            {/* Files List */}
            <div className="mt-6 space-y-2 max-h-96 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-background border border-border rounded-lg p-3">
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
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-foreground truncate">{file}</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-2 bg-success text-success-foreground rounded-md hover:bg-success/90 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveToBin(file)}
                      className="p-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                      title="Move to bin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No files yet. Upload some files to get started!</p>
              )}
            </div>

            {/* Download Selected */}
            <button
              onClick={handleMultipleDownload}
              disabled={selectedFiles.length === 0 || loading}
              className="w-full mt-4 bg-accent text-accent-foreground py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 font-medium"
            >
              Download Selected ({selectedFiles.length})
            </button>
          </div>

          {/* Bin Section */}
          <div className="bg-card rounded-xl p-6 shadow-xl border border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              Recycle Bin
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              Files are automatically deleted after 30 days
            </p>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {binFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-background border border-border rounded-lg p-3">
                  <span className="text-foreground truncate flex-1">{file}</span>
                  <button
                    onClick={() => restoreFromBin(file)}
                    className="p-2 bg-warning text-warning-foreground rounded-md hover:bg-warning/90 transition-colors"
                    title="Restore file"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {binFiles.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Bin is empty</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;