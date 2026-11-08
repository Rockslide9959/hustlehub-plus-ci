// Babel is used only by Jest, to turn JSX and modern imports into code Node can run.
// Vite does its own transforming for the dev server and the production build.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};