/**
 * DeveloperSettingsPanel — Developer-focused settings panel.
 *
 * Simplified version of the design-centric SettingsDialog that:
 *   - KEEPS: Execution mode, Agent selection, Model picker, API protocol configs,
 *     Language, Appearance, Notifications, Skills, Memory, Privacy, About
 *   - REMOVES: Critique Theater, Pet, Design Systems (moved to advanced/hidden),
 *     Project Locations (simplified)
 *   - ADDS: Project Type Detection, Vite Port Configuration, Terminal Settings,
 *     File Edit Settings (auto-apply, backup before edit, etc.)
 */
import React, { useCallback, useMemo, useState } from 'react';
import type { AppConfig, AppTheme } from '../types';
import { useAppDeveloper } from '../providers/app-developer-provider';
import styles from './DeveloperSettingsPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeveloperSettingsPanelProps {
  /** Current application config */
  config: AppConfig;
  /** Callback to update config fields */
  onConfigChange: (updates: Partial<AppConfig>) => void;
  /** Close the settings panel */
  onClose: () => void;
  /** Additional CSS class */
  className?: string;
}

/** Settings navigation sections */
type SettingsSection =
  | 'general'
  | 'agent'
  | 'api'
  | 'appearance'
  | 'terminal'
  | 'file-edit'
  | 'skills'
  | 'memory'
  | 'notifications'
  | 'privacy'
  | 'about';

interface SectionDef {
  id: SettingsSection;
  label: string;
  icon?: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'general', label: 'General' },
  { id: 'agent', label: 'Agent & Model' },
  { id: 'api', label: 'API Protocol' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'file-edit', label: 'File Editing' },
  { id: 'skills', label: 'Skills' },
  { id: 'memory', label: 'Memory' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'about', label: 'About' },
];

// ---------------------------------------------------------------------------
// SVG icon helpers
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 2.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, hint, disabled }) => (
  <div className={styles.row}>
    <div>
      <div className={styles.rowLabel}>{label}</div>
      {hint && <div className={styles.rowHint}>{hint}</div>}
    </div>
    <div className={styles.rowControl}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className={styles.toggleTrack} />
      </label>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

/** General settings: execution mode, language, project type detection */
const GeneralSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => {
  const devState = useAppDeveloper();
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>General</h3>

      <div className={styles.row}>
        <div>
          <div className={styles.rowLabel}>Execution Mode</div>
          <div className={styles.rowHint}>
            Daemon mode uses the built-in server; API mode connects to an external endpoint
          </div>
        </div>
        <div className={styles.rowControl}>
          <select
            className={styles.select}
            value={config.mode}
            onChange={(e) => onConfigChange({ mode: e.target.value as AppConfig['mode'] })}
          >
            <option value="daemon">Daemon</option>
            <option value="api">API (BYOK)</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <div className={styles.rowLabel}>Project Type</div>
          <div className={styles.rowHint}>
            Auto-detected from project configuration files
          </div>
        </div>
        <div className={styles.rowControl}>
          <span className={styles.badge}>
            {devState.projectType ?? 'Unknown'}
          </span>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <div className={styles.rowLabel}>Vite Dev Port</div>
          <div className={styles.rowHint}>
            Port for the Vite HMR preview server
          </div>
        </div>
        <div className={styles.rowControl}>
          <input
            className={`${styles.input} ${styles.inputSmall}`}
            type="number"
            value={devState.vitePort ?? ''}
            placeholder="5173"
            onChange={(e) => {
              const port = parseInt(e.target.value, 10);
              devState.setVitePort(isNaN(port) ? 5173 : port);
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Agent & Model settings */
const AgentSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>Agent & Model</h3>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Agent</div>
        <div className={styles.rowHint}>
          Select the AI agent for code generation
        </div>
      </div>
      <div className={styles.rowControl}>
        <select
          className={styles.select}
          value={config.agentId ?? ''}
          onChange={(e) => onConfigChange({ agentId: e.target.value || null })}
        >
          <option value="">Default</option>
          <option value="codex">Codex</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
        </select>
      </div>
    </div>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Model</div>
      </div>
      <div className={styles.rowControl}>
        <input
          className={styles.input}
          type="text"
          value={config.model}
          onChange={(e) => onConfigChange({ model: e.target.value })}
          placeholder="claude-sonnet-4-5"
        />
      </div>
    </div>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Max Tokens</div>
        <div className={styles.rowHint}>
          Maximum response length from the model
        </div>
      </div>
      <div className={styles.rowControl}>
        <input
          className={`${styles.input} ${styles.inputSmall}`}
          type="number"
          value={config.maxTokens ?? 8192}
          onChange={(e) => onConfigChange({ maxTokens: parseInt(e.target.value, 10) || 8192 })}
        />
      </div>
    </div>
  </div>
);

/** API Protocol settings */
const ApiSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>API Protocol</h3>
    <p className={styles.sectionDesc}>
      Configure the API endpoint and authentication for the selected provider.
    </p>

    <div className={styles.row}>
      <div className={styles.rowLabel}>Protocol</div>
      <div className={styles.rowControl}>
        <select
          className={styles.select}
          value={config.apiProtocol ?? 'anthropic'}
          onChange={(e) => onConfigChange({ apiProtocol: e.target.value as AppConfig['apiProtocol'] })}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="azure">Azure</option>
          <option value="google">Google</option>
          <option value="ollama">Ollama</option>
        </select>
      </div>
    </div>

    <div className={styles.row}>
      <div className={styles.rowLabel}>Base URL</div>
      <div className={styles.rowControl}>
        <input
          className={styles.input}
          type="url"
          value={config.baseUrl}
          onChange={(e) => onConfigChange({ baseUrl: e.target.value })}
          placeholder="https://api.anthropic.com"
        />
      </div>
    </div>

    <div className={styles.row}>
      <div className={styles.rowLabel}>API Key</div>
      <div className={styles.rowControl}>
        <input
          className={styles.input}
          type="password"
          value={config.apiKey}
          onChange={(e) => onConfigChange({ apiKey: e.target.value })}
          placeholder="sk-..."
        />
      </div>
    </div>
  </div>
);

/** Appearance settings */
const AppearanceSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>Appearance</h3>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Theme</div>
      </div>
      <div className={styles.rowControl}>
        <select
          className={styles.select}
          value={config.theme ?? 'system'}
          onChange={(e) => onConfigChange({ theme: e.target.value as AppTheme })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Accent Color</div>
      </div>
      <div className={styles.rowControl}>
        <input
          type="color"
          value={config.accentColor ?? '#c96442'}
          onChange={(e) => onConfigChange({ accentColor: e.target.value })}
          style={{
            width: 32,
            height: 28,
            padding: 2,
            border: `1px solid var(--border)`,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
      </div>
    </div>
  </div>
);

/** Terminal settings */
const TerminalSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = () => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>
      Terminal
      <span className={`${styles.badge} ${styles.badgeNew}`} style={{ marginLeft: 8 }}>New</span>
    </h3>
    <p className={styles.sectionDesc}>
      Configure the integrated terminal for running dev servers, tests, and CLI tools.
    </p>

    <Toggle
      label="Enable Terminal"
      checked={true}
      onChange={() => {/* handled by daemon */}}
      hint="Show the terminal tab in the workspace"
    />

    <Toggle
      label="Auto-start Dev Server"
      checked={false}
      onChange={() => {/* future: auto-start vite dev */}}
      hint="Automatically run `npm run dev` when opening a project"
    />

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Default Shell</div>
        <div className={styles.rowHint}>Shell used for new terminal sessions</div>
      </div>
      <div className={styles.rowControl}>
        <select className={styles.select} defaultValue="auto">
          <option value="auto">Auto-detect</option>
          <option value="bash">bash</option>
          <option value="zsh">zsh</option>
          <option value="fish">fish</option>
          <option value="powershell">PowerShell</option>
        </select>
      </div>
    </div>
  </div>
);

/** File Editing settings */
const FileEditSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = () => {
  const devState = useAppDeveloper();
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        File Editing
        <span className={`${styles.badge} ${styles.badgeNew}`} style={{ marginLeft: 8 }}>New</span>
      </h3>
      <p className={styles.sectionDesc}>
        Control how AI-generated file edits are applied to your project.
      </p>

      <Toggle
        label="Auto-apply Edits"
        checked={devState.autoApply}
        onChange={devState.setAutoApply}
        hint="Automatically write file edits to disk without confirmation"
      />

      <Toggle
        label="Backup Before Edit"
        checked={devState.backupBeforeEdit}
        onChange={devState.setBackupBeforeEdit}
        hint="Create .bak copies of files before overwriting"
      />

      <div className={styles.row}>
        <div>
          <div className={styles.rowLabel}>Recent Edits</div>
          <div className={styles.rowHint}>
            {devState.recentEdits.length} files edited in this session
          </div>
        </div>
        <div className={styles.rowControl}>
          <span className={styles.badge}>{devState.recentEdits.length}</span>
        </div>
      </div>
    </div>
  );
};

/** Skills settings */
const SkillsSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>Skills</h3>
    <p className={styles.sectionDesc}>
      Enable or disable AI skills. File-edit skills are highlighted for app developer mode.
    </p>

    <div className={styles.row}>
      <div className={styles.rowLabel}>Active Skill</div>
      <div className={styles.rowControl}>
        <span className={styles.badge}>
          {config.skillId ?? 'app-developer'}
        </span>
      </div>
    </div>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>File-edit Skills</div>
        <div className={styles.rowHint}>
          Skills that use the &lt;file-edit&gt; output format for direct code writing
        </div>
      </div>
      <div className={styles.rowControl}>
        <span className={styles.badge}>Enabled</span>
      </div>
    </div>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Disabled Skills</div>
        <div className={styles.rowHint}>
          {(config.disabledSkills ?? []).length} skills disabled
        </div>
      </div>
    </div>
  </div>
);

/** Memory settings */
const MemorySection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>Memory</h3>

    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>Custom Instructions</div>
        <div className={styles.rowHint}>
          Persistent context injected into every conversation
        </div>
      </div>
    </div>
    <textarea
      className={styles.input}
      style={{
        width: '100%',
        maxWidth: '100%',
        minHeight: 80,
        resize: 'vertical',
        fontFamily: 'var(--sans)',
        marginTop: 4,
      }}
      value={config.customInstructions ?? ''}
      onChange={(e) => onConfigChange({ customInstructions: e.target.value })}
      placeholder="e.g. Always use TypeScript strict mode. Prefer functional components."
    />
  </div>
);

/** Notifications settings */
const NotificationsSection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => {
  const notifications = config.notifications;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Notifications</h3>

      <Toggle
        label="Sound on Completion"
        checked={notifications?.soundEnabled ?? false}
        onChange={(v) =>
          onConfigChange({
            notifications: { ...notifications!, soundEnabled: v },
          })
        }
        hint="Play a sound when an AI turn completes"
      />

      <Toggle
        label="Desktop Notifications"
        checked={notifications?.desktopEnabled ?? false}
        onChange={(v) =>
          onConfigChange({
            notifications: { ...notifications!, desktopEnabled: v },
          })
        }
        hint="Show browser notifications for completed runs"
      />
    </div>
  );
};

/** Privacy settings */
const PrivacySection: React.FC<{
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
}> = ({ config, onConfigChange }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>Privacy</h3>

    <Toggle
      label="Usage Metrics"
      checked={config.telemetry?.metrics ?? true}
      onChange={(v) =>
        onConfigChange({ telemetry: { ...config.telemetry!, metrics: v } })
      }
      hint="Anonymous usage metrics help improve the product"
    />

    <Toggle
      label="Content Telemetry"
      checked={config.telemetry?.content ?? true}
      onChange={(v) =>
        onConfigChange({ telemetry: { ...config.telemetry!, content: v } })
      }
      hint="Share anonymized conversation content for quality improvement"
    />

    <Toggle
      label="Artifact Manifest"
      checked={config.telemetry?.artifactManifest ?? false}
      onChange={(v) =>
        onConfigChange({ telemetry: { ...config.telemetry!, artifactManifest: v } })
      }
      hint="Share artifact metadata for marketplace recommendations"
    />
  </div>
);

/** About section */
const AboutSection: React.FC = () => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>About</h3>

    <div className={styles.row}>
      <div className={styles.rowLabel}>Mode</div>
      <div className={styles.rowControl}>
        <span className={styles.badge}>App Developer</span>
      </div>
    </div>

    <div className={styles.row}>
      <div className={styles.rowLabel}>Version</div>
      <div className={styles.rowControl}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          0.1.0-dev
        </span>
      </div>
    </div>

    <p className={styles.sectionDesc} style={{ marginTop: 12 }}>
      Open Design — App Developer Mode enables AI-powered file editing,
      live Vite HMR preview, and integrated terminal for building
      full-stack applications with React, TypeScript, and Tauri.
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const DeveloperSettingsPanel: React.FC<DeveloperSettingsPanelProps> = ({
  config,
  onConfigChange,
  onClose,
  className,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  // Render the active section
  const renderSection = useMemo(() => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection config={config} onConfigChange={onConfigChange} />;
      case 'agent':
        return <AgentSection config={config} onConfigChange={onConfigChange} />;
      case 'api':
        return <ApiSection config={config} onConfigChange={onConfigChange} />;
      case 'appearance':
        return <AppearanceSection config={config} onConfigChange={onConfigChange} />;
      case 'terminal':
        return <TerminalSection config={config} onConfigChange={onConfigChange} />;
      case 'file-edit':
        return <FileEditSection config={config} onConfigChange={onConfigChange} />;
      case 'skills':
        return <SkillsSection config={config} onConfigChange={onConfigChange} />;
      case 'memory':
        return <MemorySection config={config} onConfigChange={onConfigChange} />;
      case 'notifications':
        return <NotificationsSection config={config} onConfigChange={onConfigChange} />;
      case 'privacy':
        return <PrivacySection config={config} onConfigChange={onConfigChange} />;
      case 'about':
        return <AboutSection />;
      default:
        return null;
    }
  }, [activeSection, config, onConfigChange]);

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Developer Settings"
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Developer Settings</h2>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close settings"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Navigation tabs */}
      <nav className={styles.nav} role="tablist">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`${styles.navItem} ${section.id === activeSection ? styles.navItemActive : ''}`}
            role="tab"
            aria-selected={section.id === activeSection}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {/* Section body */}
      <div className={styles.body}>
        {renderSection}
      </div>
    </div>
  );
};

export default DeveloperSettingsPanel;
