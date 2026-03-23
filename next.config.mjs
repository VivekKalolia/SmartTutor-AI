/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'better-sqlite3': 'commonjs better-sqlite3',
      });
    }

    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@xenova/transformers',
      'better-sqlite3',
      'pdf-parse',
      'mupdf',
    ],
    outputFileTracingIncludes: {
      '/api/rag/upload': ['./node_modules/mupdf/dist/*.wasm'],
    },
  },
};

export default nextConfig;
