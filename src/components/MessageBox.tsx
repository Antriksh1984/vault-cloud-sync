interface MessageBoxProps {
  text: string;
  onClose: () => void;
}

const MessageBox = ({ text, onClose }: MessageBoxProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 text-center space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Notification</h3>
          <p className="text-muted-foreground">{text}</p>
          <button
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;