import React from 'react';
import ResourceUploader from '../components/ResourceUploader';

const AdminResourcesUpload: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h2>🗂️ Upload Resources</h2>
      <p style={{ color: '#777' }}>Add PDF files or YouTube videos for students.</p>
      <ResourceUploader />
    </div>
  );
};

export default AdminResourcesUpload;
