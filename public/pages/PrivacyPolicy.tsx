import React from 'react'

const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>

      <p>
        Sciora (“we”, “our”, or “us”) is committed to protecting your privacy. This Privacy Policy
        explains how we collect, use, and safeguard your information when you visit our website,
        https://sciora.name.ng, and use our educational services.
      </p>

      <h2>Information We Collect</h2>
      <ul>
        <li>Personal Information: We may collect your name, student ID, and email address when you register or interact with our platform.</li>
        <li>Usage Data: We use Google Analytics to collect data about your visit, including pages viewed, time spent, and general location.</li>
        <li>Cookies: We use cookies to improve user experience and deliver personalized ads via Google AdSense.</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To provide access to learning materials and tools.</li>
        <li>To track quiz performance and generate results.</li>
        <li>To improve our website and understand user behavior.</li>
        <li>To display relevant ads using Google AdSense.</li>
      </ul>

      <h2>Third-Party Services</h2>
      <p>
        We use third-party services like Google Analytics and Google AdSense. These tools may use cookies and collect anonymous usage data.
        Learn more about Google’s privacy practices here: <br />
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          https://policies.google.com/privacy
        </a>
      </p>

      <h2>Student Data</h2>
      <p>
        Any student information collected is used strictly for educational purposes. We do not sell, share, or misuse student data.
      </p>

      <h2>Your Choices</h2>
      <p>
        You can disable cookies in your browser settings. You can also opt-out of personalized ads using your Google Ad settings.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have any questions or concerns about this Privacy Policy, please contact us at:<br />
        <strong>Email:</strong> zayyaddahiru@gmail.com<br />
        <strong>Phone:</strong> +234-7038351471
      </p>
    </div>
  )
}

export default PrivacyPolicy
