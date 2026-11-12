import UIKit
import Capacitor

@objc(LocketBridgeViewController)
class LocketBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LocketNativePlugin())
    }
}

