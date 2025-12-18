import { useState } from 'react';
import { 
  X, 
  Search,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Twitter,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  Code,
  Database,
  Server,
  Cloud,
  Star,
  Heart,
  Zap,
  Target,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  Link,
  ExternalLink,
  Instagram,
  Youtube,
  Twitch,
  Dribbble,
  Figma,
  Terminal,
  Cpu,
  Smartphone,
  Monitor,
  Coffee
} from 'lucide-react';
import './IconPicker.css';

// Map of icons with their FontAwesome LaTeX commands
const RESUME_ICONS = [
  // Contact & Social
  { id: 'email', name: 'Email', icon: Mail, latex: '\\faEnvelope', category: 'contact' },
  { id: 'phone', name: 'Phone', icon: Phone, latex: '\\faPhone', category: 'contact' },
  { id: 'location', name: 'Location', icon: MapPin, latex: '\\faMapMarker', category: 'contact' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, latex: '\\faLinkedin', category: 'social' },
  { id: 'github', name: 'GitHub', icon: Github, latex: '\\faGithub', category: 'social' },
  { id: 'twitter', name: 'Twitter/X', icon: Twitter, latex: '\\faTwitter', category: 'social' },
  { id: 'globe', name: 'Website', icon: Globe, latex: '\\faGlobe', category: 'contact' },
  { id: 'link', name: 'Link', icon: Link, latex: '\\faLink', category: 'contact' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, latex: '\\faInstagram', category: 'social' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, latex: '\\faYoutube', category: 'social' },
  
  // Professional
  { id: 'briefcase', name: 'Work', icon: Briefcase, latex: '\\faBriefcase', category: 'professional' },
  { id: 'graduation', name: 'Education', icon: GraduationCap, latex: '\\faGraduationCap', category: 'professional' },
  { id: 'award', name: 'Award', icon: Award, latex: '\\faTrophy', category: 'professional' },
  { id: 'certificate', name: 'Certificate', icon: FileText, latex: '\\faCertificate', category: 'professional' },
  { id: 'users', name: 'Team', icon: Users, latex: '\\faUsers', category: 'professional' },
  { id: 'target', name: 'Goal', icon: Target, latex: '\\faBullseye', category: 'professional' },
  
  // Tech
  { id: 'code', name: 'Code', icon: Code, latex: '\\faCode', category: 'tech' },
  { id: 'terminal', name: 'Terminal', icon: Terminal, latex: '\\faTerminal', category: 'tech' },
  { id: 'database', name: 'Database', icon: Database, latex: '\\faDatabase', category: 'tech' },
  { id: 'server', name: 'Server', icon: Server, latex: '\\faServer', category: 'tech' },
  { id: 'cloud', name: 'Cloud', icon: Cloud, latex: '\\faCloud', category: 'tech' },
  { id: 'cpu', name: 'Hardware', icon: Cpu, latex: '\\faMicrochip', category: 'tech' },
  { id: 'mobile', name: 'Mobile', icon: Smartphone, latex: '\\faMobile', category: 'tech' },
  { id: 'desktop', name: 'Desktop', icon: Monitor, latex: '\\faDesktop', category: 'tech' },
  
  // Design
  { id: 'dribbble', name: 'Dribbble', icon: Dribbble, latex: '\\faDribbble', category: 'design' },
  { id: 'figma', name: 'Figma', icon: Figma, latex: '\\faFigma', category: 'design' },
  
  // General
  { id: 'star', name: 'Star', icon: Star, latex: '\\faStar', category: 'general' },
  { id: 'heart', name: 'Heart', icon: Heart, latex: '\\faHeart', category: 'general' },
  { id: 'bolt', name: 'Lightning', icon: Zap, latex: '\\faBolt', category: 'general' },
  { id: 'check', name: 'Checkmark', icon: CheckCircle, latex: '\\faCheckCircle', category: 'general' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, latex: '\\faCalendar', category: 'general' },
  { id: 'clock', name: 'Clock', icon: Clock, latex: '\\faClock', category: 'general' },
  { id: 'coffee', name: 'Coffee', icon: Coffee, latex: '\\faCoffee', category: 'general' },
];

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'contact', name: 'Contact' },
  { id: 'social', name: 'Social' },
  { id: 'professional', name: 'Professional' },
  { id: 'tech', name: 'Tech' },
  { id: 'general', name: 'General' },
];

export default function IconPicker({ isOpen, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  if (!isOpen) return null;

  const filteredIcons = RESUME_ICONS.filter(icon => {
    const matchesSearch = icon.name.toLowerCase().includes(search.toLowerCase()) ||
                          icon.latex.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || icon.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleIconClick = (icon) => {
    // Copy to clipboard
    navigator.clipboard.writeText(icon.latex);
    setCopiedId(icon.id);
    setTimeout(() => setCopiedId(null), 1500);
    
    // Notify parent
    if (onSelect) {
      onSelect(icon);
    }
  };

  return (
    <div className="icon-picker-overlay" onClick={onClose}>
      <div className="icon-picker" onClick={e => e.stopPropagation()}>
        <div className="icon-picker-header">
          <h3>Insert Icon</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="icon-picker-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="icon-picker-categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-btn ${category === cat.id ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="icon-picker-grid">
          {filteredIcons.map(icon => {
            const IconComponent = icon.icon;
            return (
              <button
                key={icon.id}
                className={`icon-item ${copiedId === icon.id ? 'copied' : ''}`}
                onClick={() => handleIconClick(icon)}
                title={`${icon.name}\n${icon.latex}`}
              >
                <IconComponent size={20} />
                <span className="icon-name">{icon.name}</span>
                {copiedId === icon.id && (
                  <span className="copied-badge">Copied!</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="icon-picker-footer">
          <p>Click an icon to copy its LaTeX command. Use in your resume like:</p>
          <code>\faLinkedin\ LinkedIn Profile</code>
        </div>
      </div>
    </div>
  );
}
