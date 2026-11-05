import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import Footer from '../components/Footer';
import FeedbackCarousel from '../components/FeedbackCarousel';
import FeedbackButton from '../components/FeedbackButton';
import BlogCarousel from '../components/BlogCarousel';


// Keyframes for animations
const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Styled Components
const PageWrapper = styled.div`
  background-color: ${({ theme }) => theme.colors.background};
`;

const HeroSection = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background-image: url('https://images.unsplash.com/photo-1648792940059-3b782a7b8b20?q=80&w=1932&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  text-align: center;
`;

const HeroOverlay = styled.div`
  position: absolute;
  inset: 0;
  background-color: rgba(8, 8, 8, 0.6);
  z-index: 1;
`;

const HeroContent = styled(motion.div)`
  position: relative;
  z-index: 2;
  padding: 0 1.5rem 5rem;
  max-width: 800px;
  color: white;
`;

const MainHeading = styled(motion.h1)`
  font-size: ${({ theme }) => theme.fontSizes.xlarge};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  font-weight: bold;
  background: linear-gradient(45deg, ${({ theme }) => theme.colors.primary}, #a6c1ee);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-fill-color: transparent;
  background-size: 200% 200%;
  animation: ${gradientAnimation} 5s ease infinite;
`;

const Subheading = styled(motion.p)`
  font-size: ${({ theme }) => theme.fontSizes.large};
  margin-bottom: ${({ theme }) => theme.spacing.large};
  color: #E0E0E0;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.medium};
  justify-content: center;
  flex-wrap: wrap;
`;

const StyledButton = styled(motion.button)`
  padding: 1rem 2.5rem;
  font-size: ${({ theme }) => theme.fontSizes.medium};
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;

  &.primary {
    background-color: ${({ theme }) => theme.colors.secondary};
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
  }

  &.secondary {
    background-color: #1A535C;
    box-shadow: 0 4px 15px rgba(26, 83, 92, 0.3);
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }
`;

const Section = styled.section`
  padding: 4rem 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
`;

const WelcomeSection = styled(Section)`
  background-image: url('https://images.unsplash.com/photo-1621529355377-b1685d2a7d77?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D');
  background-size: cover;
  background-position: center;
  position: relative;
  color: black; /* Set font color to black */

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(245, 237, 237, 0.64); /* More transparent white overlay */
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
`;

const AboutSection = styled(Section)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  flex-wrap: wrap;
  background-image: url('https://images.unsplash.com/photo-1622295023825-6e319464b810?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'); /* New background image */
  background-size: cover;
  background-position: center;
  position: relative; /* Needed for overlay */

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to right, rgba(215, 208, 208, 0.54), rgba(146, 175, 233, 0.8)); /* Overlay for readability */
    z-index: 0;
  }

  > * {
    position: relative; /* Ensure content is above overlay */
    z-index: 1;
  }
`;

const GlassSection = styled(Section)`
  background-image: url(https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=928&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D);
  background-size: cover;
  background-position: center;
`;

const GlassContainer = styled.div`
  background: ${({ theme }) => theme.colors.glassBg};
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 1px solid ${({ theme }) => theme.colors.glassBorder};
  padding: 3rem 2rem;
  max-width: 900px;
  margin: 0 auto;
  box-shadow: ${({ theme }) => theme.boxShadow};
  color: whitesmoke;
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.large};
  font-weight: bold;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  color: ${({ theme, color }) => color || theme.colors.text};
`;

const SectionText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.medium};
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
  color: ${({ theme, color }) => color || theme.colors.textLight};
`;

const BlogPreviewSection = styled(Section)`
  background-image: url('https://images.unsplash.com/photo-1546074177-ffdda98d214f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D');
  background-size: cover;
  background-position: center;
  color: #fff; /* Ensure text is readable on the new background */
`;

const BlogGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  padding: 2rem 0;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ViewAllButton = styled(Link)`
  display: inline-block;
  margin-top: 2rem;
  padding: 0.8rem 2rem;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  border-radius: 50px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }
`;

export default function LandingPage() {
  const handleEnterClassroom = () => {
    window.location.href = '/student';
  };

  return (
    <PageWrapper>
      <HeroSection>
        <HeroOverlay />
        <HeroContent
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <MainHeading
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Sciora
          </MainHeading>

          <Subheading
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Live. Learn. Excel.
          </Subheading>

          <ButtonGroup>
            <StyledButton
              className="primary"
              onClick={handleEnterClassroom}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.1 }}
            >
              Enter Classroom →
            </StyledButton>

            <Link to="/blog">
              <StyledButton
                className="secondary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.1 }}
              >
                Visit Sciora Blog →
              </StyledButton>
            </Link>
          </ButtonGroup>
        </HeroContent>
      </HeroSection>

      <WelcomeSection>
        <SectionTitle>Welcome to Sciora</SectionTitle>
        <SectionText color="black">
          Sciora is your gateway to mastering life sciences and biotechnology. Whether you're
          preparing for exams or supporting students in the lab, Sciora makes academic tools more
          accessible and effective.
        </SectionText>
      </WelcomeSection>

      <AboutSection>
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ flex: '1 1 400px', maxWidth: '600px' }}
        >
          <SectionTitle color="#1a2a4d">About Sciora</SectionTitle>
          <SectionText color="black">
            Sciora is a modern digital classroom platform designed for students and lecturers in
            life sciences and biotechnology. Our mission is to streamline learning through
            interactive content, real-time assessments, and student-centered design.
            <br />
            <br />
            Every feature of Sciora is crafted to improve clarity and academic performance.
          </SectionText>
        </motion.div>
        
      <FeedbackCarousel />
      </AboutSection>

      <GlassSection>
        <GlassContainer>
          <SectionTitle color="whitesmoke">Why Choose Sciora?</SectionTitle>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '1.2rem', lineHeight: '2', color: 'whitesmoke' }}>
            {[
              '🎓 Comprehensive Learning Resources: Access a vast library of lecture notes, study guides, and supplementary materials, all meticulously organized by course and week.',
              '📝 Interactive Quizzes & Assessments: Test your knowledge with engaging quizzes featuring instant feedback, detailed explanations, and performance tracking to pinpoint areas for improvement.',
              '🤝 Collaborative Q&A Forums: Connect with peers and instructors in dedicated course-specific forums to ask questions, share insights, and deepen your understanding of complex topics.',
              '📈 Personalized Progress Tracking: Monitor your academic journey with intuitive dashboards that visualize your quiz scores, study habits, and overall mastery of course content.',
              '💡 Innovative Learning Tools: Benefit from cutting-edge features like interactive 3D models, video lectures, and real-world case studies that bring life sciences and biotechnology to life.',
              '🔒 Secure & Accessible Platform: Enjoy a secure and user-friendly environment, accessible from any device, ensuring your learning experience is seamless and protected.',
            ].map((item, index) => (
              <li key={index} style={{ marginBottom: '1.5rem' }} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        </GlassContainer>
      </GlassSection>

      <BlogPreviewSection>
        <SectionTitle>Latest from Our Blog</SectionTitle>
        <SectionText>Stay updated with our latest articles, tips, and insights.</SectionText>
        <BlogCarousel />
        <ViewAllButton to="/blog">View All Posts →</ViewAllButton>
      </BlogPreviewSection>

      <Footer />
      <FeedbackButton />
    </PageWrapper>
  );
}
''
