/**
 * PM2 Ecosystem File — 24/7 Career-OPS Autonomous Deployment
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs        # Start all processes
 *   pm2 stop ecosystem.config.cjs         # Stop all processes
 *   pm2 restart ecosystem.config.cjs      # Restart all
 *   pm2 logs                              # View logs
 *   pm2 status                            # View status
 *
 * Auto-restart on crash:
 *   pm2 startup                           # Generate startup script
 *   pm2 save                              # Save process list
 */

module.exports = {
  apps: [
    {
      name: 'career-ops-daemon',
      script: 'daemon.mjs',
      node_args: '--experimental-modules',
      env: {
        NODE_ENV: 'production',
        SAFE_MODE: process.env.SAFE_MODE || 'true',
        PIPELINE_INTERVAL: process.env.PIPELINE_INTERVAL || '3600',
        SCAN_INTERVAL: process.env.SCAN_INTERVAL || '180',
        MAX_APPLY_PER_RUN: process.env.MAX_APPLY_PER_RUN || '10',
        MIN_SCORE: process.env.MIN_SCORE || '3.5',
        PIPELINE_WORKERS: process.env.PIPELINE_WORKERS || '3',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      },
      error_file: 'logs/daemon-error.log',
      out_file: 'logs/daemon-out.log',
      log_file: 'logs/daemon-combined.log',
      time: true,
      max_restarts: 20,
      restart_delay: 10000,
      exp_backoff_restart_delay: 30000,
      max_memory_restart: '500M',
      kill_timeout: 10000,
      watch: false,
    },
    {
      name: 'career-ops-server',
      script: 'server.mjs',
      node_args: '--experimental-modules',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3001',
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
        CORS_ORIGIN: 'true',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      },
      error_file: 'logs/server-error.log',
      out_file: 'logs/server-out.log',
      time: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '300M',
      kill_timeout: 15000,
      watch: false,
    },
    {
      name: 'career-ops-dashboard',
      cwd: 'dashboard-next',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      error_file: '../logs/dashboard-error.log',
      out_file: '../logs/dashboard-out.log',
      time: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
