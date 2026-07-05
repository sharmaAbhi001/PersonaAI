
module.exports = {
  apps: [
    {
      name: "genpersona-api",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
