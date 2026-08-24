import type { IconType } from 'react-icons';
import {
  FaAws,
  FaBoxArchive,
  FaBridge,
  FaBug,
  FaChartLine,
  FaClock,
  FaCloud,
  FaCode,
  FaDatabase,
  FaDesktop,
  FaDocker,
  FaEnvelope,
  FaFire,
  FaFolder,
  FaGaugeHigh,
  FaGear,
  FaGithub,
  FaGlobe,
  FaGoogle,
  FaHardDrive,
  FaKey,
  FaLayerGroup,
  FaLock,
  FaMagnifyingGlass,
  FaMicrosoft,
  FaMobileScreen,
  FaNetworkWired,
  FaPlug,
  FaRoute,
  FaServer,
  FaShieldHalved,
  FaSitemap,
  FaTerminal,
  FaTriangleExclamation,
  FaUser,
  FaUsers,
  FaWindowMaximize,
} from 'react-icons/fa6';

/**
 * A small, curated icon set rather than a searchable browser across
 * react-icons' full (tens of thousands of icons) surface — keeps the picker
 * usable. All from Font Awesome 6 so they render consistently at one
 * visual weight. Brand icons (AWS, GCP, Azure, Docker, GitHub) cover the
 * common "which platform is this" case; there is no dedicated AWS
 * *service* icon set here (see README) since Simple Icons dropped
 * Amazon's marks and AWS does not publish an npm package for its official
 * architecture icons.
 */
export interface IconOption {
  key: string;
  label: string;
  Icon: IconType;
}

export const ICON_OPTIONS: IconOption[] = [
  { key: 'server', label: 'Server', Icon: FaServer },
  { key: 'database', label: 'Database', Icon: FaDatabase },
  { key: 'hard-drive', label: 'Storage', Icon: FaHardDrive },
  { key: 'cloud', label: 'Cloud', Icon: FaCloud },
  { key: 'globe', label: 'Globe / Internet', Icon: FaGlobe },
  { key: 'network', label: 'Network', Icon: FaNetworkWired },
  { key: 'route', label: 'Router / DNS', Icon: FaRoute },
  { key: 'gauge', label: 'Load balancer', Icon: FaGaugeHigh },
  { key: 'bridge', label: 'Gateway', Icon: FaBridge },
  { key: 'plug', label: 'API', Icon: FaPlug },
  { key: 'envelope', label: 'Queue / Messaging', Icon: FaEnvelope },
  { key: 'layer-group', label: 'Cluster / Group', Icon: FaLayerGroup },
  { key: 'sitemap', label: 'Subsystem', Icon: FaSitemap },
  { key: 'box', label: 'Container', Icon: FaBoxArchive },
  { key: 'folder', label: 'Storage bucket', Icon: FaFolder },
  { key: 'terminal', label: 'Compute / CLI', Icon: FaTerminal },
  { key: 'code', label: 'Function / Lambda', Icon: FaCode },
  { key: 'gear', label: 'Service', Icon: FaGear },
  { key: 'lock', label: 'Encryption', Icon: FaLock },
  { key: 'key', label: 'Auth / Keys', Icon: FaKey },
  { key: 'shield', label: 'Firewall / Security', Icon: FaShieldHalved },
  { key: 'user', label: 'User / Actor', Icon: FaUser },
  { key: 'users', label: 'Users', Icon: FaUsers },
  { key: 'browser', label: 'Browser / Client', Icon: FaWindowMaximize },
  { key: 'desktop', label: 'Desktop app', Icon: FaDesktop },
  { key: 'mobile', label: 'Mobile app', Icon: FaMobileScreen },
  { key: 'chart', label: 'Analytics', Icon: FaChartLine },
  { key: 'search', label: 'Search', Icon: FaMagnifyingGlass },
  { key: 'clock', label: 'Scheduler / Cron', Icon: FaClock },
  { key: 'fire', label: 'Cache', Icon: FaFire },
  { key: 'bug', label: 'Monitoring / Errors', Icon: FaBug },
  { key: 'alert', label: 'Alert', Icon: FaTriangleExclamation },
  { key: 'aws', label: 'AWS', Icon: FaAws },
  { key: 'google', label: 'Google Cloud', Icon: FaGoogle },
  { key: 'microsoft', label: 'Azure / Microsoft', Icon: FaMicrosoft },
  { key: 'docker', label: 'Docker', Icon: FaDocker },
  { key: 'github', label: 'GitHub', Icon: FaGithub },
];

const ICON_BY_KEY = new Map(ICON_OPTIONS.map((opt) => [opt.key, opt.Icon]));

export function getIconComponent(key: string | undefined): IconType | undefined {
  if (!key) return undefined;
  return ICON_BY_KEY.get(key);
}
