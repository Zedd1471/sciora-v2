import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const ResourcesPage: React.FC = () => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setResources(data);
      setLoading(false);
    };

    fetchResources();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>📚 Learning Resources</h1>
      {loading ? (
        <p>Loading...</p>
      ) : resources.length === 0 ? (
        <p>No resources uploaded yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {resources.map((res) => (
            <li
              key={res.id}
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{res.title}</h3>
              <p style={{ marginBottom: '0.5rem', color: '#666' }}>{res.description}</p>
              <a
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '0.5rem',
                  color: '#4ECDC4',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                📥 Download / Open Resource
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ResourcesPage;
