import { classifyMode, Mode } from '../../../../core/cognita/modeClassifier'

export class RouterService {
  classify(text: string): Mode {
    return classifyMode(text)
  }
}

export default new RouterService()
