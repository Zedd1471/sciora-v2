import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { supabase } from '../services/supabaseClient';
import PostPreviewCard from '../components/PostPreviewCard';
import FullPostView from '../components/FullPostView';

// Define Post type matching the database schema
interface Post {
  id: string;
  title: string;
  author_name: string;
  content: string;
  video_url?: string;
  created_at: string;
}

const BlogPageContainer = styled.main`
  padding: 4rem 2rem;
  background: url('https://images.unsplash.com/photo-1642428668784-43cdfca2813e?q=80&w=1931&auto=format&fit=crop&ixlib=rb-4.1.0') no-repeat center center fixed;
  background-size: cover;
  color: whitesmoke;
  text-align: center;
  min-height: 100vh;
`;

const PostGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 2rem auto;
`;

const BlogPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, author_name, content, video_url, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data as Post[]);
        if (postId) {
          const post = (data as Post[]).find(p => p.id === postId);
          setSelectedPost(post || null);
        }
      }
      setLoading(false);
    };

    fetchPosts();
  }, [postId]);

  const handlePostClick = (post: Post) => {
    navigate(`/blog/${post.id}`);
  };

  const handleBack = () => {
    navigate('/blog');
    setSelectedPost(null);
  };

  if (loading) {
    return <BlogPageContainer><h1>Loading posts...</h1></BlogPageContainer>;
  }

  return (
    <BlogPageContainer>
      {selectedPost ? (
        <FullPostView post={selectedPost} onBack={handleBack} />
      ) : (
        <>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Sciora Blog</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
            Your source for academic insights, lab tips, and research skills.
          </p>
          <PostGrid>
            {posts.map(post => (
              <PostPreviewCard 
                key={post.id} 
                post={post} 
                onClick={() => handlePostClick(post)} 
              />
            ))}
          </PostGrid>
        </>
      )}
    </BlogPageContainer>
  );
};

export default BlogPage;

