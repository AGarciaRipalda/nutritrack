/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',      // Genera la carpeta 'out'
    trailingSlash: true,   // Evita errores 404 en subpáginas
    images: {
        unoptimized: true,   // Necesario para que las imágenes no fallen
    },
};

module.exports = nextConfig;