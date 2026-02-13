-- KEYS[1]: Token counter key
-- KEYS[2]: Timestamp key (last refill time)
-- ARGV[1]: Capacity (max tokens)
-- ARGV[2]: Refill Rate (tokens per second)
-- ARGV[3]: Current Timestamp (ms)
-- ARGV[4]: Requested Tokens (cost)

local token_key = KEYS[1]
local timestamp_key = KEYS[2]

local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- Fetch current stats
local last_tokens = tonumber(redis.call("get" , token_key))
local last_refilled = tonumber(redis.call("get" , timestamp_key))

-- Intialized if missing
if last_tokens == nil then
  last_tokens = capacity
  last_refilled = now
end

-- Calculate refill
local delta = math.max(0 , now - last_refilled)
local filled_tokens = delta * (rate / 100)
local new_tokens = math.min(capacity , last_tokens + filled_tokens)

-- Check and consume 
local allowed = 0
if new_tokens >= requested then
  new_tokens = new_tokens - requested
  allowed = 1
else
  allowed = 0
end

-- Save states
redis.call("set" , token_key , new_tokens)
redis.call("set" , timestamp_key , now)

-- Set expiry (1 hour idle time cleans up keys)
redis.call("expire" , token_key , 3600)
redis.call("expire" , timestamp_key , 3600)

return { allowed, new_tokens }