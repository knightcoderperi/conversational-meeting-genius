
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, Key, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { transcriptionAPI, SETUP_INSTRUCTIONS } from '@/utils/apiConfiguration';

export const APIConfigurationDialog: React.FC = () => {
  const [selectedAPI, setSelectedAPI] = useState<'openai' | 'google' | 'assemblyai' | 'azure'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [region, setRegion] = useState('eastus');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSaveConfiguration = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }

    const config: any = {};
    
    switch (selectedAPI) {
      case 'openai':
        config.openai = { apiKey, model: 'whisper-1' };
        break;
      case 'google':
        config.google = { apiKey, endpoint: 'https://speech.googleapis.com/v1/speech:recognize' };
        break;
      case 'assemblyai':
        config.assemblyai = { apiKey, endpoint: 'https://api.assemblyai.com/v2' };
        break;
      case 'azure':
        config.azure = { apiKey, region, endpoint: `https://${region}.api.cognitive.microsoft.com/` };
        break;
    }

    transcriptionAPI.setConfiguration(config);
    transcriptionAPI.setSelectedAPI(selectedAPI);
    
    setIsConfigured(true);
    setIsOpen(false);
    toast.success(`${SETUP_INSTRUCTIONS[selectedAPI].name} configured successfully!`);
  };

  const apiOptions = [
    { value: 'openai', label: 'OpenAI Whisper', badge: '$0.006/min', color: 'bg-green-100 text-green-800' },
    { value: 'google', label: 'Google Speech-to-Text', badge: '60min free', color: 'bg-blue-100 text-blue-800' },
    { value: 'assemblyai', label: 'AssemblyAI', badge: 'Free tier', color: 'bg-purple-100 text-purple-800' },
    { value: 'azure', label: 'Azure Speech', badge: '5h/month free', color: 'bg-orange-100 text-orange-800' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2">
          {isConfigured ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span>API Configured</span>
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              <span>Configure API</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>Configure Transcription API</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* API Selection */}
          <div className="space-y-3">
            <Label>Choose your transcription service:</Label>
            <div className="grid grid-cols-2 gap-3">
              {apiOptions.map((option) => (
                <Card 
                  key={option.value}
                  className={`cursor-pointer transition-all border-2 ${
                    selectedAPI === option.value ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedAPI(option.value as any)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{option.label}</span>
                      <Badge className={option.color}>{option.badge}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Setup Instructions */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center space-x-2">
                <ExternalLink className="w-4 h-4" />
                <span>Setup {SETUP_INSTRUCTIONS[selectedAPI].name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                {SETUP_INSTRUCTIONS[selectedAPI].steps.map((step, index) => (
                  <div key={index}>{step}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* API Key Input */}
          <div className="space-y-3">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key here..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Azure Region (if Azure is selected) */}
          {selectedAPI === 'azure' && (
            <div className="space-y-3">
              <Label htmlFor="region">Azure Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eastus">East US</SelectItem>
                  <SelectItem value="westus">West US</SelectItem>
                  <SelectItem value="westeurope">West Europe</SelectItem>
                  <SelectItem value="eastasia">East Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfiguration}>
              Save Configuration
            </Button>
          </div>

          {/* Code Example */}
          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-sm">Quick Setup Code</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-x-auto">
                {SETUP_INSTRUCTIONS[selectedAPI].example}
              </pre>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
