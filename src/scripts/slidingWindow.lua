-- src/scripts/slidingWindow.lua

-- KEYS[1]: Rate limit key
-- ARGV[1]: Window size in milliseconds
-- ARGV[2]: Max allowed requests
-- ARGV[3]: Current timestamp (ms)
-- ARGV[4]: Unique Request ID

local key = KEYS[1]
local window = tonumber(ARGV[1]) 
local limit = tonumber(ARGV[2])  
local now = tonumber(ARGV[3])
local req_id = ARGV[4]

-- Remove requests older than the window
local clearBefore = now - window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- Count requests in current window
local count = redis.call('ZCARD', key)

-- Check logic
if count < limit then
  -- Allowed: Add current timestamp
  redis.call('ZADD', key, now, req_id)
  redis.call('EXPIRE', key, math.ceil(window / 1000))

  -- Remaining = Limit - (Count + 1) because we just added one
  return { 1, limit - (count + 1) }
else
  -- Denied
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after = 0
  if oldest and oldest[2] then
    retry_after = tonumber(oldest[2]) + window - now
  end

  return { 0, math.max(0, retry_after) }
end
