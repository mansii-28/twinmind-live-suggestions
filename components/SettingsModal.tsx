'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw, Save } from 'lucide-react';
import { defaultSettings } from '../lib/defaults';
import { AppSettings } from '../lib/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // Load from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('twinmind_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Only update if it contains meaningful data
          if (parsed && typeof parsed === 'object') {
            setTimeout(() => {
              setSettings(prev => ({ ...prev, ...parsed }));
            }, 0);
          }
        } catch (e) {
          console.error("Failed to parse settings", e);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('twinmind_settings', JSON.stringify(settings));
    onClose();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  const handleChange = (field: keyof AppSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">TwinMind Settings</h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* API Configuration */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">API Configuration</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Groq API Key</label>
              <input 
                type="password" 
                value={settings.groqApiKey}
                onChange={(e) => handleChange('groqApiKey', e.target.value)}
                placeholder="gsk_..." 
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
              />
            </div>
          </section>

          {/* System Prompts */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">System Prompts</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Live Suggestion Prompt</label>
              <textarea 
                value={settings.liveSuggestionPrompt}
                onChange={(e) => handleChange('liveSuggestionPrompt', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Answer Prompt</label>
              <textarea 
                value={settings.detailedAnswerPrompt}
                onChange={(e) => handleChange('detailedAnswerPrompt', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Direct Chat Prompt</label>
              <textarea 
                value={settings.directChatPrompt}
                onChange={(e) => handleChange('directChatPrompt', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors resize-none"
              />
            </div>
          </section>
          
          {/* Context & Limits */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Context & Limits</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 pr-2">Live Suggestion Context (entries)</label>
                <input 
                  type="number" 
                  value={settings.liveSuggestionContextWindow}
                  onChange={(e) => handleChange('liveSuggestionContextWindow', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Answer Context (entries)</label>
                <input 
                  type="number" 
                  value={settings.detailedAnswerContextWindow}
                  onChange={(e) => handleChange('detailedAnswerContextWindow', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chat Context (entries)</label>
                <input 
                  type="number" 
                  value={settings.chatContextWindow}
                  onChange={(e) => handleChange('chatContextWindow', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Audio Chunk Duration (sec)</label>
                <input 
                  type="number" 
                  value={settings.audioChunkDurationSeconds}
                  onChange={(e) => handleChange('audioChunkDurationSeconds', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </section>

          {/* Model Parameters */}
          <section className="space-y-4 border-b border-slate-100 pb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
             <h3>Model Parameters</h3>
          </section>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Suggestion Temp</label>
                <input 
                  type="number" 
                  step="0.05"
                  value={settings.suggestionTemperature}
                  onChange={(e) => handleChange('suggestionTemperature', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chat Temp</label>
                <input 
                  type="number" 
                  step="0.05"
                  value={settings.chatTemperature}
                  onChange={(e) => handleChange('chatTemperature', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50 disabled:bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white"
                />
              </div>
          </section>
        </div>
        
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button 
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-800 rounded-md transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </button>
          
          <button 
            onClick={handleSave}
            className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
