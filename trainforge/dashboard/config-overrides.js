const { overrideDevServer } = require('customize-cra');

const devServerConfig = () => (config) => {
    return {
        ...config,
        // Forcefully remove COOP/COEP headers to allow Firebase popup auth
        setupMiddlewares: (middlewares, devServer) => {
            // Ensure completely open COOP/COEP policies
            devServer.app.use((req, res, next) => {
                res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
                res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
                next();
            });

            // Call original setupMiddlewares if it exists
            if (config.setupMiddlewares) {
                return config.setupMiddlewares(middlewares, devServer);
            }
            return middlewares;
        },
        // Ensure webpack dev server injects these headers
        headers: {
            'Cross-Origin-Opener-Policy': 'unsafe-none',
            'Cross-Origin-Embedder-Policy': 'unsafe-none',
        },
    };
};

module.exports = {
    devServer: overrideDevServer(devServerConfig()),
};
