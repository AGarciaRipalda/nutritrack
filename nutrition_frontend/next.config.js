/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        unoptimized: true,
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://79.76.109.162:8000/:path*',
            },
        ];
    },
};

module.exports = nextConfig;