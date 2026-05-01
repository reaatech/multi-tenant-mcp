# Skill: Performance

## Purpose

Monitor and optimize performance for the multi-tenant-mcp monorepo, ensuring low-latency
multi-tenant operations.

## Capabilities

- **Performance Benchmarking** — Run benchmarks for critical paths
- **Latency Profile Analysis** — Analyze latency distribution across operations
- **Bottleneck Identification** — Identify performance bottlenecks
- **Optimization Suggestions** — Suggest performance improvements
- **Resource Usage Monitoring** — Monitor CPU, memory, and I/O usage

## Input Parameters

```json
{
  "action": "benchmark | analyze-latency | identify-bottlenecks | monitor-resources",
  "options": {
    "target": "string",
    "package": "string",
    "iterations": "number",
    "concurrent": "number",
    "duration": "number",
    "warmup": "number"
  }
}
```

## Output

- Benchmark results with statistics (mean, median, p95, p99, max)
- Latency distribution charts and analysis
- Bottleneck report with specific code locations
- Optimization recommendations with expected improvements
- Resource usage metrics and trends

## Usage Examples

### Benchmark Rate Limiter

```json
{
  "action": "benchmark",
  "options": {
    "target": "rate-limiter",
    "package": "rate-limiter",
    "iterations": 10000,
    "concurrent": 100,
    "warmup": 1000
  }
}
```

### Analyze Latency Profile

```json
{
  "action": "analyze-latency",
  "options": {
    "target": "tenant-resolver",
    "package": "tenant-resolver",
    "iterations": 5000,
    "percentiles": [50, 90, 95, 99]
  }
}
```

### Identify Bottlenecks

```json
{
  "action": "identify-bottlenecks",
  "options": {
    "package": "middleware",
    "scenario": "high-concurrency-multi-tenant",
    "duration": 60,
    "concurrent": 1000
  }
}
```

## When to Invoke

- After optimizing or refactoring hot paths in any package
- When adding a new storage backend (Redis, S3, DB)
- Before release to validate latency budgets
- When CI performance benchmarks regress
- Run benchmarks from `e2e/src/performance/`

## Invocation Actions

1. Run e2e benchmarks: `pnpm turbo run test --filter=e2e`
2. Run specific package tests: `pnpm turbo run test --filter=@reaatech/multi-tenant-mcp-<name>`
3. Profile with Vitest benchmark mode
4. Compare against baselines

## Performance Targets

### Latency
- **Tenant Resolution** — <1ms (in-memory cache)
- **Rate Limit Check** — <2ms (Redis)
- **Tool Filtering** — <1ms (in-memory)
- **Total Middleware Overhead** — <5ms per request

### Throughput
- **Requests per Second** — >10,000 RPS per instance
- **Concurrent Tenants** — >1,000 active tenants
- **Rate Limit Operations** — >50,000 ops/sec

### Resource Usage
- **Memory per Instance** — <500MB baseline
- **CPU Usage** — <80% under load
- **Network I/O** — Optimized for minimal overhead

## Benchmark Scenarios

### Single Tenant
- Baseline performance with single tenant
- Measures overhead of multi-tenancy infrastructure

### Multi-Tenant (Low Concurrency)
- 10 tenants, 10 requests/sec each
- Tests tenant isolation overhead

### Multi-Tenant (High Concurrency)
- 100 tenants, 100 requests/sec each
- Tests scalability and resource contention

### Rate Limit Stress Test
- 1,000 tenants hitting rate limits
- Tests rate limiter performance under pressure

### Mixed Workload
- Realistic mix of operations (resolve, limit, filter, track)
- Tests end-to-end performance

## Configuration

Configured via `skills.config.json`:

```json
{
  "performance": {
    "maxLatencyMs": 5,
    "benchmarkIterations": 10000,
    "targets": {
      "requestsPerSecond": 10000,
      "concurrentTenants": 1000,
      "rateLimitOpsPerSec": 50000
    }
  }
}
```

## Error Handling

- Benchmark failure → Report with partial results
- Timeout → Kill long-running benchmarks and report
- Resource exhaustion → Stop and report resource limits
- Analysis failure → Report with available data
