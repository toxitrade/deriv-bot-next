'use client';

import { useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StrategyId } from '@/hooks/use-signal-engine';
import type { IndicatorConfig } from '@/lib/types';

export interface StrategyTabProps {
  strategyId: StrategyId;
  onStrategyIdChange: (id: StrategyId) => void;
  indicatorConfig: IndicatorConfig;
  onIndicatorConfigChange: (config: IndicatorConfig) => void;
}

const STRATEGIES: { id: StrategyId; name: string }[] = [
  { id: 'multi-momentum', name: 'Multi Momentum' },
  { id: 'fast-ema-sma-cross', name: 'EMA/SMA Cross Fast' },
  { id: 'adaptive-confluence', name: 'Adaptive Confluence' },
  { id: 'doji', name: 'Doji' },
];

export function StrategyTab({
  strategyId,
  onStrategyIdChange,
  indicatorConfig,
  onIndicatorConfigChange,
}: StrategyTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateConfig = (partial: Partial<IndicatorConfig>) => {
    onIndicatorConfigChange({ ...indicatorConfig, ...partial });
  };

  const updateEnabled = (key: keyof NonNullable<IndicatorConfig['enabled']>, value: boolean) => {
    updateConfig({
      enabled: { ...indicatorConfig.enabled, [key]: value },
    });
  };

  const handleExport = useCallback(() => {
    const data = JSON.stringify({ strategyId, indicatorConfig }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy-${strategyId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [strategyId, indicatorConfig]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.strategyId) onStrategyIdChange(parsed.strategyId);
        if (parsed.indicatorConfig) onIndicatorConfigChange(parsed.indicatorConfig);
      } catch {
        /* ignore invalid files */
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onStrategyIdChange, onIndicatorConfigChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select
              value={strategyId}
              onValueChange={(v) => onStrategyIdChange(v as StrategyId)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Indicators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="rsi-enabled">RSI</Label>
            <Switch
              id="rsi-enabled"
              checked={indicatorConfig.enabled?.rsi ?? true}
              onCheckedChange={(v) => updateEnabled('rsi', v)}
            />
          </div>
          {indicatorConfig.enabled?.rsi !== false && (
            <div className="grid grid-cols-3 gap-2 pl-4">
              <div className="space-y-1">
                <Label className="text-xs">Period</Label>
                <Input
                  type="number"
                  value={indicatorConfig.rsiPeriod ?? 7}
                  onChange={(e) => updateConfig({ rsiPeriod: parseInt(e.target.value) || 7 })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">High</Label>
                <Input
                  type="number"
                  value={indicatorConfig.rsiHigh ?? 70}
                  onChange={(e) => updateConfig({ rsiHigh: parseInt(e.target.value) || 70 })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Low</Label>
                <Input
                  type="number"
                  value={indicatorConfig.rsiLow ?? 30}
                  onChange={(e) => updateConfig({ rsiLow: parseInt(e.target.value) || 30 })}
                  className="h-8"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="stoch-enabled">Stochastic</Label>
            <Switch
              id="stoch-enabled"
              checked={indicatorConfig.enabled?.stoch ?? true}
              onCheckedChange={(v) => updateEnabled('stoch', v)}
            />
          </div>
          {indicatorConfig.enabled?.stoch !== false && (
            <div className="pl-4">
              <div className="space-y-1">
                <Label className="text-xs">Period</Label>
                <Input
                  type="number"
                  value={indicatorConfig.stochPeriod ?? 14}
                  onChange={(e) => updateConfig({ stochPeriod: parseInt(e.target.value) || 14 })}
                  className="h-8 w-24"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="macd-enabled">MACD</Label>
            <Switch
              id="macd-enabled"
              checked={indicatorConfig.enabled?.macd ?? true}
              onCheckedChange={(v) => updateEnabled('macd', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sma-enabled">SMA</Label>
            <Switch
              id="sma-enabled"
              checked={indicatorConfig.enabled?.sma ?? true}
              onCheckedChange={(v) => updateEnabled('sma', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bb-enabled">Bollinger Bands</Label>
            <Switch
              id="bb-enabled"
              checked={indicatorConfig.enabled?.bb ?? true}
              onCheckedChange={(v) => updateEnabled('bb', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Config Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Min Confirmations</Label>
              <Input
                type="number"
                value={indicatorConfig.minConfirmations ?? 3}
                onChange={(e) =>
                  updateConfig({ minConfirmations: parseInt(e.target.value) || 3 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>SMA Fast</Label>
              <Input
                type="number"
                value={indicatorConfig.smaFast ?? 9}
                onChange={(e) => updateConfig({ smaFast: parseInt(e.target.value) || 9 })}
              />
            </div>
            <div className="space-y-1">
              <Label>SMA Slow</Label>
              <Input
                type="number"
                value={indicatorConfig.smaSlow ?? 21}
                onChange={(e) => updateConfig({ smaSlow: parseInt(e.target.value) || 21 })}
              />
            </div>
            <div className="space-y-1">
              <Label>BB Period</Label>
              <Input
                type="number"
                value={indicatorConfig.bbPeriod ?? 20}
                onChange={(e) => updateConfig({ bbPeriod: parseInt(e.target.value) || 20 })}
              />
            </div>
            <div className="space-y-1">
              <Label>BB StdDev</Label>
              <Input
                type="number"
                value={indicatorConfig.bbStdDev ?? 2}
                onChange={(e) =>
                  updateConfig({ bbStdDev: parseFloat(e.target.value) || 2 })
                }
                step="0.5"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleExport} variant="outline" size="sm" className="flex-1">
              Export JSON
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="flex-1">
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
