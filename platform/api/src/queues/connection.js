import IORedis from 'ioredis';

export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableOfflineQueue: false,  // Don't buffer commands when disconnected
  lazyConnect: true,          // Don't connect until first command
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('⚠️  Redis not available — queues disabled. Set REDIS_URL to enable background jobs.');
      return null; // stop retrying
    }
    return Math.min(times * 1000, 3000);
  },
});

redisConnection.on('error', (err) => {
  // Suppress repeated ECONNREFUSED noise in dev when Redis isn't running
  if (err.code !== 'ECONNREFUSED') {
    console.error('Redis error:', err.message);
  }
});
