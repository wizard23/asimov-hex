import { BladeApi, BladeController, View } from '@tweakpane/core';
import { createBlade } from '@tweakpane/core';
import { ViewProps } from '@tweakpane/core';
import { colorToRgb, getBrightness } from './core/utils/color-utils';
import { ColorValue } from './types';

interface DrawStateBladeConfig {
  numStates: number;
  palette: Record<number, ColorValue>;
  drawState: number;
  onStateChange: (state: number) => void;
}

class DrawStateBladeView implements View {
  public readonly element: HTMLElement;
  private buttons: HTMLElement[] = [];

  constructor(config: DrawStateBladeConfig) {
    this.element = document.createElement('div');
    this.element.style.display = 'flex';
    this.element.style.gap = '4px';
    this.element.style.flexWrap = 'wrap';
    this.element.style.padding = '4px 0';

    this.buildButtons(config);
  }

  private updateSelection(selectedState: number, numStates: number) {
    this.buttons.forEach((button, index) => {
      if (index < numStates) {
        if (index === selectedState) {
          button.style.border = '3px solid #ffff00';
          button.style.boxShadow = '0 0 5px rgba(255, 255, 0, 0.8)';
        } else {
          button.style.border = '2px solid #666';
          button.style.boxShadow = 'none';
        }
      }
    });
  }

  public update(config: DrawStateBladeConfig) {
    this.buildButtons(config);
  }

  private buildButtons(config: DrawStateBladeConfig) {
    this.buttons.forEach(btn => btn.remove());
    this.buttons = [];

    for (let i = 0; i < config.numStates; i++) {
      const button = document.createElement('button');
      button.style.width = '24px';
      button.style.height = '24px';
      button.style.border = '2px solid #666';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.padding = '0';
      button.style.margin = '0';
      button.title = `State ${i}`;

      const colorValue = config.palette[i] ?? '#000000';
      const colorStr = this.colorToCss(colorValue);
      button.style.backgroundColor = colorStr;

      const brightness = getBrightness(colorValue);
      button.style.color = brightness > 128 ? '#000000' : '#ffffff';

      button.addEventListener('click', () => {
        config.onStateChange(i);
        this.updateSelection(i, config.numStates);
      });

      this.element.appendChild(button);
      this.buttons.push(button);
    }

    this.updateSelection(config.drawState, config.numStates);
  }

  private colorToCss(color: ColorValue): string {
    if (typeof color === 'string') return color;
    const rgb = colorToRgb(color);
    const r = rgb.r.toString(16).padStart(2, '0');
    const g = rgb.g.toString(16).padStart(2, '0');
    const b = rgb.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
}

class DrawStateBladeController extends BladeController<DrawStateBladeView> {
  constructor(config: DrawStateBladeConfig) {
    super({
      blade: createBlade(),
      view: new DrawStateBladeView(config),
      viewProps: ViewProps.create(),
    });
  }
}

export class DrawStateBladeApi extends BladeApi<DrawStateBladeController> {
  constructor(controller: DrawStateBladeController) {
    super(controller);
  }

  public update(config: DrawStateBladeConfig) {
    this.controller.view.update(config);
  }
}

export function createDrawStateBlade(config: DrawStateBladeConfig): DrawStateBladeApi {
  const controller = new DrawStateBladeController(config);
  return new DrawStateBladeApi(controller);
}
