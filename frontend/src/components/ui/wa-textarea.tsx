'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';

interface WATextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

const FORMAT_BUTTONS = [
  { icon: Bold, label: 'Bold', prefix: '*', suffix: '*', title: 'Bold (*teks*)' },
  { icon: Italic, label: 'Italic', prefix: '_', suffix: '_', title: 'Italic (_teks_)' },
  { icon: Strikethrough, label: 'Strikethrough', prefix: '~', suffix: '~', title: 'Coret (~teks~)' },
  { icon: Code, label: 'Monospace', prefix: '```', suffix: '```', title: 'Monospace (```teks```)' },
];

const WATextarea = React.forwardRef<HTMLTextAreaElement, WATextareaProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const applyFormat = (prefix: string, suffix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      if (selectedText) {
        // Wrap selected text
        const newValue = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
        onChange(newValue);
        // Restore cursor after the formatted text
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        });
      } else {
        // Insert placeholder
        const placeholder = prefix + 'teks' + suffix;
        const newValue = value.substring(0, start) + placeholder + value.substring(end);
        onChange(newValue);
        // Select the placeholder text
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, start + prefix.length + 4);
        });
      }
    };

    return (
      <div className="space-y-0">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border border-b-0 rounded-t-md bg-muted/30 px-1.5 py-1">
          {FORMAT_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              type="button"
              title={btn.title}
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent textarea blur
                applyFormat(btn.prefix, btn.suffix);
              }}
            >
              <btn.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className={cn(
            'flex min-h-[60px] w-full rounded-b-md rounded-t-none border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            className
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      </div>
    );
  }
);
WATextarea.displayName = 'WATextarea';

export { WATextarea };
