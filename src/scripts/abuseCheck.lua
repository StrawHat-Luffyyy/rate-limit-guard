-- KEYS[1]: Violation Key (e.g., abuse:violations:ip:127.0.0.1)
-- KEYS[2]: Block Key (e.g., abuse:blocked:ip:127.0.0.1)
-- ARGV[1]: Violation Expiry (e.g., 3600s - how long we remember bad behavior)
-- ARGV[2]: Block Threshold (e.g., 5 violations = block)
-- ARGV[3]: Block Duration (e.g., 86400s - 24 hours)

local violation_key = KEYS[1]
local block_key = KEYS[2]
local violation_ttl = tonumber(ARGV[1])
local threshold = tonumber(ARGV[2])
local block_duration = tonumber(ARGV[3])


-- Check if already blocked
if redis.call("EXISTS", block_key) == 1 then
  local ttl = redis.call("TTL", block_key)
  return { 1, ttl } -- { IsBlocked, TimeRemaining }
end

-- Increament Violation
local count = redis.call("INCR", violation_key)

-- Set expiry on first violation
if count == 1 then
  redis.call("EXPIRE", violation_key, violation_ttl)
end

-- Check if the threshold is reached
if count >= threshold then
  --Block the user!
  redis.call("SET", block_key, "1", "EX", block_duration)
  return { 1, block_duration }
end

return { 0, count } -- { NotBlocked, CurrentViolationCount }
