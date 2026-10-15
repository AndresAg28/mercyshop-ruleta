/** Paleta tomada del logo de MercyShop */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        mercy: {
          50: '#FFF1F5',
          100: '#FDD7E0', // fondo del logo
          200: '#F9B8C9',
          400: '#E0457B',
          600: '#C2185B', // rosa fucsia del texto
          700: '#A3134C',
          900: '#5E0B2D',
          cherry: '#C8102E',
          leaf: '#5B8C3A'
        }
      },
      fontFamily: {
        display: ['"Bodoni Moda"', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
