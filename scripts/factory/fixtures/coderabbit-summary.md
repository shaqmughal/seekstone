<!-- coderabbit-ai-generated:v1 -->

<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<details>
<summary><strong>Security architecture risk:</strong> <strong><picture><img src="https://storage.googleapis.com/coderabbit_public_assets/review-comment-icons-v1/risk-low-16.svg" width="16" height="16" align="absmiddle" alt=""></picture> Low</strong> · up to <code>45683</code></summary>
<dl>
<dd>
<br>

<!-- architecture_review_start -->
<!-- architecture_review_label
### Security Architecture Review

**Security architecture risk:** **🔵 Low** · up to `45683`
-->

The change improves crash resistance without exposing the new filesystem hooks through the inspected tool inputs. A narrow failure-containment regression remains: when writers overlap on the same note, an open failure can now remove another writer's temporary file and cause that write to fail.

**Retained concerns**
- **Low · reliability · inferred:** Cleanup now runs after a failed open, even though that invocation acquired no temporary-file handle. Because concurrent writers share the fixed temporary pathname, this can unlink another writer's in-flight file and make its subsequent rename fail. At the comparison base, an open failure inside writeFile occurred outside the cleanup block. The broader shared-path race is pre-existing; this additional failure-propagation path is introduced by the PR.

<details>
<summary><strong>Security review details</strong></summary>
<dl>
<dd>
<br>

**Security Blast Radius**
- _inferred_ — The identified cleanup regression affects writers sharing one destination's deterministic temporary pathname. It requires overlapping writes and a pre-rename failure; it does not establish cross-vault access or additional privileges.

**Trust Boundaries and Controls**
- _observed_ — In the inspected append_note route, request data supplies note path, content, and an optional previous hash—not filesystem callbacks. The caller performs its existing policy and path-resolution steps before invoking the two-argument helper.

**Resilience and Maintainability Implications**
- _observed_ — The added tests assert write, sync, close, and rename ordering, and preservation of the old note with temporary-file cleanup after a sync error. These test blocks were inspected but not executed during this assessment.

**Hardening Proposals**
- _proposed_ — Use exclusively created, invocation-owned temporary files in the destination directory, and limit failure cleanup to the file owned by that invocation.

</dd>
</dl>
</details>
<!-- architecture_review_end -->

</dd>
</dl>
</details>
