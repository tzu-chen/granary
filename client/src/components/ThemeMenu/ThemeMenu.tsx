import { useState, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { COLOR_SCHEMES } from '../../colorSchemes';
import { MIN_FONT_SIZE, MAX_FONT_SIZE } from '../../services/themeStorage';
import { CloseIcon, PaletteIcon } from '../Icons/Icons';
import styles from './ThemeMenu.module.css';

export function ThemeMenu() {
  const { schemeId, setScheme, fontSize, setFontSize, autoSwitch, setAutoSwitch } = useTheme();
  const [open, setOpen] = useState(false);
  const overlayMouseDownRef = useRef(false);

  return (
    <>
      <button
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Change theme"
        title="Change theme"
      >
        <PaletteIcon size={18} />
      </button>

      {open && (
        <div
          className={styles.overlay}
          onMouseDown={e => {
            overlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onClick={e => {
            if (overlayMouseDownRef.current && e.target === e.currentTarget) {
              setOpen(false);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div className={styles.panel}>
            <div className={styles.header}>
              <h3 className={styles.title}>Theme</h3>
              <button
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <div className={styles.body}>
              <div className={styles.grid}>
                {COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    className={`${styles.card} ${scheme.id === schemeId ? styles.cardActive : ''}`}
                    onClick={() => {
                      setScheme(scheme.id);
                      setOpen(false);
                    }}
                  >
                    <div className={styles.preview}>
                      <div
                        className={styles.swatchBg}
                        style={{ background: scheme.swatch.bg }}
                      >
                        <div
                          className={styles.swatchBar}
                          style={{
                            background: scheme.swatch.bgSecondary,
                            borderBottom: `2px solid ${scheme.swatch.border}`,
                          }}
                        />
                        <div className={styles.swatchBody}>
                          <div
                            className={styles.swatchCard}
                            style={{
                              background: scheme.swatch.bgSecondary,
                              border: `1px solid ${scheme.swatch.border}`,
                            }}
                          >
                            <div
                              className={styles.swatchText}
                              style={{ background: scheme.swatch.text }}
                            />
                            <div
                              className={`${styles.swatchText} ${styles.swatchTextShort}`}
                              style={{ background: scheme.swatch.textSecondary }}
                            />
                          </div>
                          <div
                            className={styles.swatchAccent}
                            style={{ background: scheme.swatch.accent }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className={styles.cardName}>{scheme.name}</span>
                  </button>
                ))}
              </div>

              <div className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowLabel}>Auto switch</span>
                  <span className={styles.rowDesc}>Light theme by day, dark by night</span>
                </div>
                <button
                  className={`${styles.toggle} ${autoSwitch.enabled ? styles.toggleOn : ''}`}
                  onClick={() => setAutoSwitch({ ...autoSwitch, enabled: !autoSwitch.enabled })}
                  role="switch"
                  aria-checked={autoSwitch.enabled}
                  aria-label="Auto theme switching"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>

              <div className={styles.fontSizeSection}>
                <label className={styles.fontSizeLabel}>Font size</label>
                <div className={styles.fontSizeControls}>
                  <button
                    className={styles.fontSizeBtn}
                    onClick={() => setFontSize(Math.max(MIN_FONT_SIZE, fontSize - 1))}
                    disabled={fontSize <= MIN_FONT_SIZE}
                    aria-label="Decrease font size"
                  >
                    A-
                  </button>
                  <span className={styles.fontSizeValue}>{fontSize}px</span>
                  <button
                    className={styles.fontSizeBtn}
                    onClick={() => setFontSize(Math.min(MAX_FONT_SIZE, fontSize + 1))}
                    disabled={fontSize >= MAX_FONT_SIZE}
                    aria-label="Increase font size"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
