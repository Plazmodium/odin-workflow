---
name: kubernetes
description: Kubernetes container orchestration for deploying, scaling, and managing containerized applications
category: devops
version: "1.28+"
depends_on:
  - docker
compatible_with:
  - terraform
  - github-actions
  - aws
---

# Kubernetes Container Orchestration

## Instructions

1. **Assess the deployment need**: Single service, microservices, or complex application.
2. **Follow Kubernetes best practices**:
   - Use namespaces for isolation
   - Set resource limits
   - Use liveness and readiness probes
   - Implement proper RBAC
3. **Provide complete manifests**: Include all necessary resources.
4. **Guide on production patterns**: High availability, scaling, monitoring.

## Core Resources

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myregistry/myapp:v1.0.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: database-url
          volumeMounts:
            - name: config
              mountPath: /app/config
      volumes:
        - name: config
          configMap:
            name: myapp-config
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
---
# External LoadBalancer
apiVersion: v1
kind: Service
metadata:
  name: myapp-external
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp
                port:
                  number: 80
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
  namespace: production
data:
  config.json: |
    {
      "logLevel": "info",
      "features": {
        "newUI": true
      }
    }
  APP_SETTING: "value"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
  namespace: production
type: Opaque
stringData:
  database-url: "postgres://user:password@host:5432/db"
  api-key: "secret-api-key"
```

## Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Vertical Pod Autoscaler

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: myapp
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
```

## Persistent Storage

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myapp-data
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 10Gi
---
# In Deployment
volumes:
  - name: data
    persistentVolumeClaim:
      claimName: myapp-data
```

## Jobs and CronJobs

```yaml
# One-time Job
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: myapp:latest
          command: ["npm", "run", "migrate"]
      restartPolicy: Never
  backoffLimit: 3
---
# CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: myapp:latest
              command: ["npm", "run", "cleanup"]
          restartPolicy: OnFailure
```

## Common Commands

```bash
# Apply manifests
kubectl apply -f deployment.yaml
kubectl apply -f ./k8s/  # Apply directory

# Get resources
kubectl get pods -n production
kubectl get pods -l app=myapp
kubectl get all -n production

# Describe (debugging)
kubectl describe pod myapp-xxx -n production
kubectl describe deployment myapp

# Logs
kubectl logs myapp-xxx -n production
kubectl logs -f myapp-xxx  # Follow
kubectl logs myapp-xxx -c container-name  # Specific container
kubectl logs --previous myapp-xxx  # Previous crash

# Shell into pod
kubectl exec -it myapp-xxx -- sh

# Port forward
kubectl port-forward svc/myapp 8080:80

# Scale
kubectl scale deployment myapp --replicas=5

# Rollout
kubectl rollout status deployment/myapp
kubectl rollout history deployment/myapp
kubectl rollout undo deployment/myapp
kubectl rollout restart deployment/myapp

# Context
kubectl config get-contexts
kubectl config use-context my-cluster
```

## Namespaces

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    env: production
---
# Resource quota per namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: production
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
```

## RBAC

```yaml
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp-sa
  namespace: production
---
# Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp-role
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list"]
---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp-rolebinding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: myapp-sa
roleRef:
  kind: Role
  name: myapp-role
  apiGroup: rbac.authorization.k8s.io
```

## Best Practices

- **Always set resource requests/limits** - Prevents resource starvation
- **Use namespaces** - Isolate environments and teams
- **Implement health probes** - Liveness for restart, readiness for traffic
- **Use ConfigMaps/Secrets** - Don't bake config into images
- **Set pod disruption budgets** - Maintain availability during updates
- **Use labels consistently** - app, version, environment, team
- **Enable RBAC** - Least privilege principle
- **Use network policies** - Restrict pod-to-pod communication

## Pod Disruption Budget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2  # Or maxUnavailable: 1
  selector:
    matchLabels:
      app: myapp
```

## Network Policy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-network-policy
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - port: 5432
```

## References

- Kubernetes Documentation: https://kubernetes.io/docs/
- kubectl Cheat Sheet: https://kubernetes.io/docs/reference/kubectl/cheatsheet/
- Best Practices: https://kubernetes.io/docs/concepts/configuration/overview/
