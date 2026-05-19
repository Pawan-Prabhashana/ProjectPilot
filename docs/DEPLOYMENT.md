# ProjectPilot Neuro — Deployment Guide

> **Target environments:** Local development · Docker · AWS (recommended production)

---

## Quick Start (Local)

```bash
# 1. Copy environment file
cp .env.example .env
# Edit .env with your database credentials and secrets

# 2. Install dependencies
npm install

# 3. Set up database and seed demo data
npm run db:setup

# 4. Start development server
npm run dev
# → http://localhost:3000
```

**Demo credentials (after seeding):**

| Role        | Email                    | Password   |
|-------------|--------------------------|------------|
| Student     | `ruvan@team-vertex.demo` | `demo1234` |
| Supervisor  | `dr.perera@demo.com`     | `demo1234` |
| Coordinator | `coord@demo.com`         | `demo1234` |

---

## Docker (Local/Staging)

### Prerequisites
- Docker Desktop or Docker Engine + Compose v2

### Start with Docker Compose

```bash
# Start PostgreSQL + Next.js app
docker compose up -d

# Run database setup + demo seed
docker compose exec app npm run db:setup

# View logs
docker compose logs -f app
```

Access at **http://localhost:3000**.

### Build standalone production image

```bash
# Build
DOCKER_BUILD=true docker build -t projectpilot-neuro:latest .

# Run (inject secrets)
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@your-rds-host:5432/projectpilot" \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e ENCRYPTION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" \
  projectpilot-neuro:latest
```

---

## AWS Deployment (Recommended Production Architecture)

```
┌──────────────────────────────────────────────────────────────────┐
│  AWS Cloud                                                        │
│                                                                   │
│  ┌──────────────┐    ┌───────────────────────────┐               │
│  │ Route 53     │───▶│  CloudFront (CDN + HTTPS)  │               │
│  │ (DNS)        │    │  - Static assets cached    │               │
│  └──────────────┘    └─────────────┬─────────────┘               │
│                                    │                              │
│                      ┌─────────────▼─────────────┐               │
│                      │  App Runner or ECS Fargate │               │
│                      │  - Docker container        │               │
│                      │  - Auto-scaling (0→N)      │               │
│                      │  - Health checks           │               │
│                      └─────────────┬─────────────┘               │
│                                    │                              │
│              ┌─────────────────────▼─────────────────────────┐   │
│              │           Private VPC Subnet                   │   │
│              │  ┌──────────────┐   ┌────────────────────────┐│   │
│              │  │ RDS Postgres  │   │ Secrets Manager        ││   │
│              │  │ (db.t3.small) │   │ - DATABASE_URL         ││   │
│              │  │ Multi-AZ      │   │ - NEXTAUTH_SECRET      ││   │
│              │  │ automated     │   │ - ENCRYPTION_SECRET    ││   │
│              │  │ backups       │   └────────────────────────┘│   │
│              │  └──────────────┘                              │   │
│              └────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ ECR           │    │ CloudWatch   │    │ S3 (optional)       │ │
│  │ (Docker       │    │ Logs +       │    │ Document uploads    │ │
│  │  registry)   │    │ Alarms       │    │ (Phase 2)           │ │
│  └──────────────┘    └──────────────┘    └─────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### AWS Services Mapping

| Component            | AWS Service           | Notes                                      |
|----------------------|-----------------------|--------------------------------------------|
| Next.js application  | App Runner            | Simplest; auto-scales from Docker image    |
| Alt: containerised   | ECS Fargate           | More control; suits team/production use    |
| Database             | RDS PostgreSQL        | `db.t3.small` for demo; Multi-AZ for prod |
| Secrets management   | Secrets Manager       | Rotate without redeployment                |
| Container registry   | ECR                   | Private image registry                     |
| CDN + HTTPS          | CloudFront            | SSL termination, static asset caching      |
| DNS                  | Route 53              | Custom domain with health-checked routing  |
| Logging              | CloudWatch Logs       | JSON log lines from the structured logger  |
| Monitoring + alerts  | CloudWatch Alarms     | Alert on 5xx rate, latency, memory         |
| CI/CD pipeline       | CodePipeline / GitHub Actions | Auto-deploy on main branch push   |

### Deployment Steps (App Runner)

```bash
# 1. Create ECR repository
aws ecr create-repository --repository-name projectpilot-neuro

# 2. Build and push image
$(aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com)

DOCKER_BUILD=true docker build -t projectpilot-neuro .
docker tag projectpilot-neuro:latest <account>.dkr.ecr.us-east-1.amazonaws.com/projectpilot-neuro:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/projectpilot-neuro:latest

# 3. Create App Runner service (via console or CLI)
# Point to ECR image, set environment variables from Secrets Manager

# 4. Run database migrations via a one-off task or during startup
# Add to container CMD:  npx prisma db push && node server.js
```

### Environment Variables (Production)

All secrets must be injected at runtime — never baked into the image.

| Variable            | Required | Description                                      | How to Generate                              |
|---------------------|----------|--------------------------------------------------|----------------------------------------------|
| `DATABASE_URL`      | ✅        | PostgreSQL connection string                     | From RDS endpoint                            |
| `NEXTAUTH_URL`      | ✅        | Full public URL of the app (with `https://`)     | Your App Runner / custom domain URL          |
| `NEXTAUTH_SECRET`   | ✅        | JWT signing secret, min 32 chars                 | `openssl rand -base64 32`                    |
| `ENCRYPTION_SECRET` | ✅        | AES-256-GCM key for field encryption             | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NODE_ENV`          | ✅        | Set to `production`                              | Hardcoded in App Runner config               |

### Database Setup (Production)

```bash
# Run schema sync (first deployment)
npx prisma db push

# Optional: run seed data for demo/staging
DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
```

**RDS Recommendations:**
- Instance: `db.t3.small` (demo) → `db.t3.medium` (production)
- Storage: `gp3`, 20 GB minimum, auto-scaling enabled
- Backup: 7-day automated backups, point-in-time recovery
- Multi-AZ: enabled for production
- Parameter group: `max_connections=200`, `log_min_duration_statement=1000`

---

## CI/CD with GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS App Runner

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          DOCKER_BUILD=true docker build -t $ECR_REGISTRY/projectpilot-neuro:$IMAGE_TAG .
          docker push $ECR_REGISTRY/projectpilot-neuro:$IMAGE_TAG

      - name: Deploy to App Runner
        run: |
          aws apprunner update-service \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --source-configuration ImageRepository={ImageIdentifier=$ECR_REGISTRY/projectpilot-neuro:$IMAGE_TAG,...}
```

---

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is ≥ 32 characters and stored in Secrets Manager
- [ ] `ENCRYPTION_SECRET` is 32 random bytes (base64) from `crypto.randomBytes`
- [ ] `DATABASE_URL` is not logged or exposed in error responses
- [ ] RDS is in a private subnet (not publicly accessible)
- [ ] Security group only allows traffic from App Runner service
- [ ] CloudFront enforces HTTPS with HSTS
- [ ] CloudWatch alarm on 5xx rate > 1% for 5 minutes
- [ ] Prisma schema does not expose password hashes in select statements
- [ ] CognitiveProfile queries are scoped by `userId` at all call sites
- [ ] `privateNote` field is AES-256-GCM encrypted (see `lib/encryption.ts`)

---

## Scaling Considerations

| Concern               | Approach                                                       |
|-----------------------|----------------------------------------------------------------|
| Read-heavy pages      | Consider React Cache or incremental static regeneration (ISR) |
| Team intelligence     | Run as background job (SQS + Lambda) rather than inline       |
| LLM integration (P2)  | AWS Bedrock (Claude/Llama) or OpenAI — injected via API key   |
| File uploads (P2)     | S3 + presigned URLs, Prisma stores S3 key only                |
| Email notifications   | AWS SES + queue-based delivery                                 |
| WebSocket/real-time   | API Gateway WebSocket or Pusher Channels                       |
| Database scaling      | Read replica for analytics queries; connection pooling (PgBouncer or RDS Proxy) |
