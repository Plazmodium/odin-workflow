# Specification: [FEATURE-ID] [Feature Name]

**Template Type**: Infrastructure Feature
**Complexity Level**: [1/2/3]
**Status**: draft

---

## 1. Context & Goals

**Problem Statement**: [What infrastructure need does this address?]

**Motivation**: [Why now? Scaling, reliability, cost, compliance?]

**Success Metrics**: [Uptime %, latency targets, cost reduction]

---

## 2. Architecture

### Current State

```
[Diagram or description of current infrastructure]
```

### Proposed State

```
[Diagram or description of target infrastructure]
```

### Changes Summary

| Component | Current | Proposed | Reason |
|-----------|---------|----------|--------|
| [Component] | [Current state] | [New state] | [Why] |

---

## 3. Deployment Configuration

### Infrastructure as Code

```yaml
# Key resource definitions (Terraform, CloudFormation, K8s manifests, etc.)
resource "[type]" "[name]" {
  # configuration
}
```

### Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| [VAR_NAME] | [Description] | [Vault / ConfigMap / .env] |

### Networking

- **Ports exposed**: [list]
- **DNS changes**: [records to add/modify]
- **Firewall rules**: [ingress/egress changes]
- **Load balancer**: [config changes]

---

## 4. Deployment Strategy

### Rollout Plan

- **Strategy**: [Rolling / Blue-green / Canary]
- **Rollback trigger**: [What failure triggers rollback]
- **Rollback steps**: [How to revert]

### Pre-Deployment Checklist

- [ ] Infrastructure provisioned in staging
- [ ] Smoke tests passing in staging
- [ ] Database migrations applied (if any)
- [ ] Environment variables configured
- [ ] DNS propagation verified
- [ ] Monitoring alerts configured

### Post-Deployment Verification

- [ ] Health check endpoints responding
- [ ] Logs flowing to monitoring system
- [ ] Metrics within expected ranges
- [ ] No increase in error rates

---

## 5. Monitoring & Observability

### Health Checks

| Endpoint | Expected | Interval |
|----------|----------|----------|
| /health | 200 OK | 30s |
| /readiness | 200 OK | 10s |

### Alerts

| Alert | Condition | Severity | Notification |
|-------|-----------|----------|-------------|
| [Name] | [Threshold] | [P1-P4] | [Slack/PagerDuty] |

### Dashboards

- [Key metrics to display]
- [SLI/SLO tracking]

---

## 6. Acceptance Criteria

- [ ] Deployed to staging and passing all health checks
- [ ] Load tested at expected peak traffic
- [ ] Rollback tested and verified
- [ ] Monitoring and alerting in place
- [ ] Runbook documented for on-call
- [ ] Cost impact estimated and approved
- [ ] [Additional criteria]

---

## 7. Scaling & Performance

### Resource Sizing

| Resource | Min | Max | Auto-scale Trigger |
|----------|-----|-----|-------------------|
| Instances/Pods | [X] | [Y] | CPU > 70% |
| Memory | [X] GB | [Y] GB | Memory > 80% |

### Performance Targets

| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| Response time (p95) | < [X]ms |
| Recovery time (RTO) | < [X]min |

---

## 8. Security

- [ ] TLS/HTTPS enforced
- [ ] Secrets managed via vault/KMS (not in code)
- [ ] Network policies restrict unnecessary access
- [ ] Container images scanned for vulnerabilities
- [ ] Principle of least privilege for IAM roles
