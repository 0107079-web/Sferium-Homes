module.exports = {
  apps: [
    {
      name: "sferium-sync-server-api",
      script: "backend/main.py",
      interpreter: "python3",
      instances: "max", // Scale to multiple CPU threads
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        DEBUG: "False"
      },
      error_file: "./logs/pm2_err.log",
      out_file: "./logs/pm2_out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS Z"
    }
  ]
};
