module.exports = {
  content: [
    './frontend/index.html',
    './frontend/src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        sand: '#f4ecde',
        ember: '#d97706',
        lagoon: '#0f766e',
        rosewood: '#7c2d12'
      },
      boxShadow: {
        soft: '0 22px 50px -24px rgba(23, 32, 51, 0.45)'
      }
    }
  },
  plugins: []
};

