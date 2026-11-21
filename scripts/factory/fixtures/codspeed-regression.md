<!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ -->
## Merging this PR will **degrade performance by 23.33%**

<details>
<summary><b>2 warnings</b></summary>

> :warning: **2 benchmarks are dominated by system calls**
>
> System calls cannot be simulated consistently and are left out of the measure. The reported value understates the real cost. Switch to the Walltime instrument to measure them.
>
> [Learn more about system calls](https://codspeed.io/docs/instruments/cpu?utm_source=github&utm_medium=comment-v2&utm_content=significant_sys_time#system-calls)
>
> [See affected benchmarks](https://app.codspeed.io/shaqmughal/seekstone/branches/factory%2FSHA-559-write-journal-safe-when-two-server-proce?q=has%3Asignificant_sys_time&utm_source=github&utm_medium=comment-v2&utm_content=affected_benchmarks)

> :warning: **1 benchmark with a significant change ran on different hardware**
>
> Its base and head results were measured on machines with a different CPU, core count or memory, so the change might not come from the code. Run base and head on the same runner type.
>
> [Learn more about Macro Runners](https://codspeed.io/docs/features/macro-runners?utm_source=github&utm_medium=comment-v2&utm_content=hardware_change)
>
> [See affected benchmarks](https://app.codspeed.io/shaqmughal/seekstone/branches/factory%2FSHA-559-write-journal-safe-when-two-server-proce?q=has%3Ahardware_change&utm_source=github&utm_medium=comment-v2&utm_content=affected_benchmarks)

</details>


`❌ 1` regressed benchmark  
`✅ 8` untouched benchmarks  
`⏩ 1` skipped benchmark[^skipped]  


> [!WARNING]
> Please fix the performance issues or [acknowledge them on CodSpeed](https://app.codspeed.io/shaqmughal/seekstone/branches/factory%2FSHA-559-write-journal-safe-when-two-server-proce?q=is%3Aregression&utm_source=github&utm_medium=comment-v2&utm_content=acknowledge).

### Performance Changes

|     | Benchmark | `BASE` | `HEAD` | Efficiency |
| --- | --------- | ------ | ------ | ---------- |
| ❌ | [`` append_note with journal ``](https://app.codspeed.io/shaqmughal/seekstone/branches/factory%2FSHA-559-write-journal-safe-when-two-server-proce?uri=packages%2Fserver%2Fsrc%2Fbench%2Fhot-paths.bench.ts%3A%3Awrite%3A%3Aappend_note%2520%28journaled%29%3A%3Aappend_note%2520with%2520journal&runnerMode=Simulation&utm_source=github&utm_medium=comment-v2&utm_content=benchmark) | 1.7 ms | 2.3 ms | -23.33% |

> [!TIP]
> Investigate this regression by commenting `@codspeedbot fix this regression` on this PR, or directly use the [CodSpeed MCP](https://codspeed.io/docs/ai/mcp?utm_source=github&utm_medium=comment-v2&utm_content=mcp_tip_regression) with your agent.

---

<sub>Comparing <code>factory/SHA-559-write-journal-safe-when-two-server-proce</code> (369cf24) with <code>main</code> (0a9006e)</sub>

<a href="https://app.codspeed.io/shaqmughal/seekstone/branches/factory%2FSHA-559-write-journal-safe-when-two-server-proce?utm_source=github&utm_medium=comment-v2&utm_content=button">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">
    <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">
  </picture>
</a>


[^skipped]: 1 benchmark was skipped, so the baseline result was used instead. If it was deleted from the codebase, [click here and archive it to remove it from the performance reports](https://app.codspeed.io/shaqmughal/seekstone/branches/factory%2FSHA-559-write-journal-safe-when-two-server-proce?q=is%3Askipped&utm_source=github&utm_medium=comment-v2&utm_content=archive).
