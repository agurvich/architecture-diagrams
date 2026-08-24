import type { IconMatchRule } from './matcherRules';

/**
 * Architecture/infra-domain rules, checked before the ported
 * LoopIconMatcher.swift table (see matcherRules.ts) since this app's nodes
 * are servers and databases, not laundry and gym sessions — the ported
 * table's vocabulary has essentially no overlap with infra terminology, so
 * without this every node would fall through to the generic fallback icon.
 * Same rule format/engine as the ported table (see iconMatcher.ts); this is
 * just a domain-appropriate rule set layered on top of it, in the same
 * spirit the brief describes the original table growing in ("grown
 * iteratively as the person tried real loop names and reported misses").
 */
export const INFRA_ICON_MATCH_RULES: IconMatchRule[] = [
  // --- Compute ---
  { pattern: 'server|host|instance|vm|compute|ec2', iconKey: 'server' },
  { pattern: 'lambda|function|serverless|faas', iconKey: 'code' },
  { pattern: 'container|docker|pod|kubernetes|k8s', iconKey: 'docker' },
  { pattern: 'terminal|cli|shell|ssh', iconKey: 'terminal' },
  { pattern: 'worker|job|cron|scheduler', iconKey: 'clock' },

  // --- Data ---
  { pattern: 'database|db|sql|postgres|postgresql|mysql|mongo|mongodb|dynamodb|rds', iconKey: 'database' },
  { pattern: 'cache|redis|memcached', iconKey: 'fire' },
  { pattern: 'storage|bucket|blob|s3|volume|disk', iconKey: 'hard-drive' },
  { pattern: 'folder|directory|file system', iconKey: 'folder' },
  { pattern: 'search|elasticsearch|solr|opensearch', iconKey: 'search' },

  // --- Networking ---
  { pattern: 'load balancer|balancer|lb', iconKey: 'gauge' },
  { pattern: 'gateway|proxy|reverse proxy', iconKey: 'bridge' },
  { pattern: 'network|vpc|subnet', iconKey: 'network' },
  { pattern: 'route|dns|routing|route53', iconKey: 'route' },
  { pattern: 'cdn|edge', iconKey: 'globe' },
  { pattern: 'firewall|security group|waf', iconKey: 'shield' },

  // --- Messaging / integration ---
  { pattern: 'queue|kafka|rabbitmq|sqs|pubsub|messaging|topic', iconKey: 'envelope' },
  { pattern: 'api|endpoint|rest|graphql|webhook', iconKey: 'plug' },
  { pattern: 'cluster|pool', iconKey: 'layer-group' },
  { pattern: 'subsystem|module|microservice|service', iconKey: 'sitemap' },

  // --- Security / access ---
  { pattern: 'lock|encryption|tls|ssl|https', iconKey: 'lock' },
  { pattern: 'key|auth|oauth|sso|login|credential|secret|secrets|iam', iconKey: 'key' },

  // --- Clients / users ---
  { pattern: 'browser|frontend|webapp|spa', iconKey: 'browser' },
  { pattern: 'desktop', iconKey: 'desktop' },
  { pattern: 'mobile|ios|android', iconKey: 'mobile' },
  { pattern: 'user|actor|customer', iconKey: 'user' },
  { pattern: 'users|team', iconKey: 'users' },

  // --- Observability ---
  { pattern: 'chart|analytics|metrics|dashboard', iconKey: 'chart' },
  { pattern: 'bug|error|exception|monitoring|logging|log|logs', iconKey: 'bug' },
  { pattern: 'alert|alarm|notification|pagerduty|paging', iconKey: 'alert' },

  // --- Platforms / brands ---
  { pattern: 'aws|amazon web services', iconKey: 'aws' },
  { pattern: 'gcp|google cloud', iconKey: 'google' },
  { pattern: 'azure', iconKey: 'microsoft' },
  { pattern: 'github|git|repo|repository', iconKey: 'github' },
  { pattern: 'cloud', iconKey: 'cloud' },
];
