export interface IconMatchRule {
  pattern: string;
  iconKey: string;
}

export const FALLBACK_ICON_KEY = 'list-check';

/**
 * Architecture/data/infra-domain keyword rules for automatic icon
 * matching (see iconMatcher.ts). No AI/LLM call — a hand-authored,
 * ordered rule table, same matching algorithm as the LoopIconMatcher.swift
 * brief this replaced (word-boundary matching with simple plural handling,
 * multi-word alternatives as substrings, most-specific rules first). The
 * original port's vocabulary was personal habits (laundry, gym, groceries)
 * with essentially no overlap with this app's actual domain, so it was
 * pruned entirely in favor of this list, grown to cover compute, data,
 * networking, messaging, security, clients, observability, and CI/CD
 * terms instead.
 */
export const ICON_MATCH_RULES: IconMatchRule[] = [
  // --- Compute ---
  { pattern: 'server|host|instance|vm|virtual machine|compute|ec2|bare metal|baremetal|hypervisor', iconKey: 'server' },
  { pattern: 'lambda|function|serverless|faas', iconKey: 'code' },
  { pattern: 'container|docker|pod|kubernetes|k8s|containerd|helm', iconKey: 'docker' },
  { pattern: 'terminal|cli|shell|ssh|bash|command line', iconKey: 'terminal' },
  { pattern: 'worker|job|cron|scheduler|batch|schedule', iconKey: 'clock' },
  { pattern: 'orchestration|orchestrator', iconKey: 'gear' },
  { pattern: 'config|configuration|settings', iconKey: 'gear' },

  // --- Data / storage ---
  {
    pattern:
      'database|db|sql|nosql|postgres|postgresql|mysql|mariadb|sqlite|oracle|mssql|sql server|mongo|mongodb|dynamodb|dynamo|cassandra|couchbase|cosmos db|cosmosdb|rds',
    iconKey: 'database',
  },
  { pattern: 'cache|redis|memcached|memcache', iconKey: 'fire' },
  { pattern: 'bucket|s3|blob storage', iconKey: 'bucket' },
  { pattern: 'storage|blob|volume|disk|object storage', iconKey: 'hard-drive' },
  { pattern: 'bulk storage|archive|cold storage', iconKey: 'boxes-stacked' },
  { pattern: 'folder|directory|file system|filesystem', iconKey: 'folder' },
  { pattern: 'file|files', iconKey: 'file' },
  { pattern: 'search|elasticsearch|solr|opensearch|algolia', iconKey: 'search' },
  { pattern: 'warehouse|data warehouse|snowflake|bigquery|redshift', iconKey: 'warehouse' },
  { pattern: 'data lake|lake', iconKey: 'database' },
  { pattern: 'etl|elt|pipeline|airflow|dbt|data pipeline', iconKey: 'route' },
  { pattern: 'backup|snapshot', iconKey: 'hard-drive' },
  { pattern: 'certificate|cert authority|ca', iconKey: 'certificate' },
  { pattern: 'maintenance|ops|operations|on-call|oncall', iconKey: 'wrench' },
  { pattern: 'architecture|topology|diagram', iconKey: 'diagram-project' },
  { pattern: 'distributed|nodes|peer to peer|p2p', iconKey: 'hexagon-nodes' },

  // --- Networking ---
  { pattern: 'load balancer|balancer|lb|alb|nlb|elb', iconKey: 'gauge' },
  { pattern: 'gateway|proxy|reverse proxy|api gateway', iconKey: 'bridge' },
  { pattern: 'network|vpc|subnet|vpn', iconKey: 'network' },
  { pattern: 'route|dns|routing|route53|nameserver|domain', iconKey: 'route' },
  { pattern: 'cdn|edge|cloudfront|fastly|akamai', iconKey: 'globe' },
  { pattern: 'firewall|security group|waf|ips|ids', iconKey: 'shield' },
  { pattern: 'ingress|egress', iconKey: 'route' },
  { pattern: 'wifi|wireless', iconKey: 'network' },

  // --- Messaging / integration ---
  {
    pattern: 'queue|kafka|rabbitmq|sqs|pubsub|pub sub|messaging|topic|activemq|nats|kinesis|pulsar|stream|streaming',
    iconKey: 'envelope',
  },
  { pattern: 'api|endpoint|rest|graphql|webhook|grpc|rpc', iconKey: 'plug' },
  { pattern: 'cluster|pool', iconKey: 'layer-group' },
  { pattern: 'subsystem|module|microservice|monolith', iconKey: 'sitemap' },
  { pattern: 'service|services', iconKey: 'gear' },
  { pattern: 'event|event bus|eventbridge|event-driven', iconKey: 'envelope' },
  { pattern: 'email|inbox|smtp', iconKey: 'envelope' },

  // --- Security / access ---
  { pattern: 'lock|encryption|encrypt|tls|ssl|https|cert|certificate', iconKey: 'lock' },
  { pattern: 'key|auth|oauth|sso|login|credential|iam|jwt|saml|identity', iconKey: 'key' },
  { pattern: 'secret|secrets|vault|kms|secrets manager', iconKey: 'key' },
  { pattern: 'rbac|permission|permissions|acl|access control', iconKey: 'shield' },

  // --- Clients / users ---
  { pattern: 'browser|frontend|webapp|web app|spa|react|vue|angular|ui|client', iconKey: 'browser' },
  { pattern: 'desktop', iconKey: 'desktop' },
  { pattern: 'mobile|ios|android|app store|play store', iconKey: 'mobile' },
  // "users" checked before "user" — both rules would otherwise match
  // "users" (the plural-handling in wordMatches makes "user" match "users"
  // too), so the more specific plural rule needs to win by coming first.
  { pattern: 'users|team|tenant|tenants', iconKey: 'users' },
  { pattern: 'user|actor|customer', iconKey: 'user' },

  // --- Observability ---
  { pattern: 'chart|analytics|metrics|dashboard|grafana|prometheus|trace|tracing|jaeger|opentelemetry|apm', iconKey: 'chart' },
  { pattern: 'bug|error|exception|monitoring|logging|log|logs|sentry|datadog', iconKey: 'bug' },
  { pattern: 'alert|alarm|notification|pagerduty|paging|opsgenie', iconKey: 'alert' },

  // --- CI/CD & source control ---
  { pattern: 'ci|cd|ci/cd|build|deploy|deployment|jenkins|circleci|github actions|pipeline build', iconKey: 'gear' },
  { pattern: 'github|git|repo|repository|version control', iconKey: 'github' },
  { pattern: 'artifact|package registry|npm|registry', iconKey: 'package' },

  // --- Platforms / brands ---
  { pattern: 'aws|amazon web services', iconKey: 'aws' },
  { pattern: 'gcp|google cloud', iconKey: 'google' },
  { pattern: 'azure', iconKey: 'microsoft' },
  { pattern: 'cloud', iconKey: 'cloud' },
];
