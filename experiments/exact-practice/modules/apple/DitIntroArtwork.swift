#if os(iOS)
import UIKit

/// Decorative whole-letter and listening illustrations from the shipped onboarding slides.
final class DitIntroArtwork: ExactNativeInstance {
    private let artwork = IntroStage()
    override var view: ExactNativeView { artwork }

    override func setProps(_ props: [String:String]) throws {
        artwork.configure(step: props["slide"] ?? "", reduced: props["reduce-motion"] == "true")
    }
    override func destroy() { artwork.configure(step: "", reduced: true) }
}

private final class IntroStage: UIView {
    private let stage = CALayer()
    private let ink = UIColor(red: 0.98, green: 0.968, blue: 0.958, alpha: 1)
    private let orange = UIColor(red: 1, green: 0.58, blue: 0.3, alpha: 1)
    private let easeOut = CAMediaTimingFunction(controlPoints: 0.23, 1, 0.32, 1)
    private var step = ""
    private var reduced = true

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        accessibilityElementsHidden = true
        clipsToBounds = true
        stage.bounds = CGRect(x: 0, y: 0, width: 480, height: 280)
        layer.addSublayer(stage)
    }
    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        let scale = min(1, bounds.width / 480, bounds.height / 280)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        stage.position = CGPoint(x: bounds.midX, y: bounds.midY)
        stage.setAffineTransform(CGAffineTransform(scaleX: scale, y: scale))
        CATransaction.commit()
    }

    func configure(step: String, reduced: Bool) {
        guard step != self.step || reduced != self.reduced else { return }
        self.step = step
        self.reduced = reduced
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        stage.sublayers?.forEach { $0.removeFromSuperlayer() }
        switch step {
        case "intro_fluency": recognition()
        case "intro_listen": headphones()
        case "intro_speed": spacing()
        default: break
        }
        CATransaction.commit()
    }

    private func text(_ value: String, point: CGFloat, center: CGPoint, color: UIColor, weight: UIFont.Weight = .semibold) -> CATextLayer {
        let font = UIFont.systemFont(ofSize: point, weight: weight)
        let text = CATextLayer()
        text.string = value
        text.font = font
        text.fontSize = point
        text.alignmentMode = .center
        text.contentsScale = max(2, traitCollection.displayScale)
        text.foregroundColor = color.cgColor
        text.bounds = CGRect(x: 0, y: 0, width: max(148, (value as NSString).size(withAttributes: [.font: font]).width + 4), height: ceil(font.lineHeight))
        text.position = center
        stage.addSublayer(text)
        return text
    }

    private func shape(_ path: UIBezierPath, fill: UIColor? = nil, stroke: UIColor? = nil, width: CGFloat = 1) -> CAShapeLayer {
        let part = CAShapeLayer()
        part.path = path.cgPath
        part.fillColor = fill?.cgColor
        part.strokeColor = stroke?.cgColor
        part.lineWidth = width
        part.lineCap = .round
        part.lineJoin = .round
        stage.addSublayer(part)
        return part
    }

    private func frames(_ layer: CALayer, _ key: String, times: [CGFloat], values: [Any]) {
        let anim = CAKeyframeAnimation(keyPath: key)
        anim.keyTimes = times.map { NSNumber(value: Double($0)) }
        anim.values = values
        anim.duration = 12
        anim.repeatCount = .infinity
        layer.add(anim, forKey: key)
    }

    private func recognition() {
        let positions: [CGFloat] = [-30,48,126,240,354,432,510]
        let scales: [CGFloat] = [0.32,0.32,0.43,1,0.43,0.32,0.32]
        let alphas: [CGFloat] = [0,0.2,0.4,1,0.4,0.2,0]
        let letters = Array("NRATE")
        var phases = [CGFloat]()
        for beat in 0..<5 {
            phases.append(CGFloat(beat))
            for sample in 0..<9 { phases.append(CGFloat(beat) + 0.8 + CGFloat(sample) * 0.025) }
            phases.removeLast() // Next beat supplies this same endpoint.
        }
        phases.append(5)
        let times = phases.map { $0 / 5 }
        for i in 0..<12 {
            let slot = min(6,i)
            let label = text(String(letters[(i+2) % 5]), point: 148,
                             center: CGPoint(x: positions[slot],y: 130), color: slot == 3 ? orange : ink)
            label.opacity = Float(alphas[slot])
            label.setAffineTransform(CGAffineTransform(scaleX: scales[slot], y: scales[slot]))
            guard !reduced else { continue }
            var xs = [CGFloat](), sizes = [CGFloat](), opacity = [CGFloat](), colors = [CGColor]()
            for p in phases {
                let from = max(0,min(6,i-Int(p))), to = max(0,min(6,i-Int(p)-1))
                let t = 1 - pow(1 - max(0,(p-floor(p)-0.8)*5),3)
                xs.append(positions[from] + (positions[to]-positions[from])*t)
                opacity.append(alphas[from] + (alphas[to]-alphas[from])*t)
                let size = scales[from] + (scales[to]-scales[from])*t
                sizes.append(size)
                let warmth = max(0,(size-0.43)/0.57)
                colors.append(UIColor(red: 0.98+0.02*warmth,green: 0.968-0.388*warmth,blue: 0.958-0.658*warmth,alpha: 1).cgColor)
            }
            frames(label,"position.x",times:times,values:xs)
            frames(label,"transform.scale",times:times,values:sizes)
            frames(label,"opacity",times:times,values:opacity)
            frames(label,"foregroundColor",times:times,values:colors)
        }
        for miss in [false,true] {
            let path = UIBezierPath()
            if miss {
                path.move(to: CGPoint(x:232,y:226)); path.addLine(to:CGPoint(x:248,y:242))
                path.move(to: CGPoint(x:248,y:226)); path.addLine(to:CGPoint(x:232,y:242))
            } else {
                path.move(to:CGPoint(x:229,y:234)); path.addLine(to:CGPoint(x:237,y:242)); path.addLine(to:CGPoint(x:252,y:225))
            }
            let mark = shape(path,stroke:miss ? .systemRed : .systemGreen,width:3)
            mark.opacity = reduced && !miss ? 1 : 0
            guard !reduced else { continue }
            var ticks = [CGFloat](), values = [CGFloat]()
            for beat in 0..<5 {
                for (offset,draw): (CGFloat,CGFloat) in [(0,0),(0.3,0),(0.367,1),(0.75,1),(0.751,0)] {
                    ticks.append((CGFloat(beat)+offset)/5)
                    values.append((beat==1) == miss ? draw : 0)
                }
            }
            ticks.append(1); values.append(0)
            frames(mark,"opacity",times:ticks,values:values)
            frames(mark,"strokeEnd",times:ticks,values:values)
        }
    }

    private func headphones() {
        func arch(_ radius: CGFloat, y: CGFloat) -> UIBezierPath {
            UIBezierPath(arcCenter:CGPoint(x:240,y:y),radius:radius,startAngle:.pi,endAngle:2 * .pi,clockwise:true)
        }
        let band = UIBezierPath()
        band.move(to:CGPoint(x:145,y:167)); band.addLine(to:CGPoint(x:145,y:127))
        band.append(arch(95,y:127)); band.addLine(to:CGPoint(x:335,y:167))
        _ = shape(band,stroke:ink.withAlphaComponent(0.2),width:18)
        _ = shape(arch(95,y:127),stroke:ink.withAlphaComponent(0.8),width:2)
        _ = shape(arch(77,y:121),stroke:ink.withAlphaComponent(0.4),width:5)
        for left in [true,false] {
            let angle = (left ? -8.0 : 8.0) * .pi / 180
            func rounded(_ rect: CGRect, radius: CGFloat, pivot: CGPoint) -> UIBezierPath {
                let path = UIBezierPath(roundedRect:rect,cornerRadius:radius)
                path.apply(CGAffineTransform(translationX:pivot.x,y:pivot.y).rotated(by:angle)
                    .translatedBy(x:-pivot.x,y:-pivot.y))
                return path
            }
            let cup = rounded(CGRect(x:left ? 130 : 307,y:137,width:43,height:92),radius:21.5,pivot:CGPoint(x:left ? 151 : 329,y:183))
            _ = shape(cup,fill:UIColor(red:0.05,green:0.08,blue:0.10,alpha:0.92),stroke:ink.withAlphaComponent(0.4),width:1.5)
            let cushion = rounded(CGRect(x:left ? 161 : 306,y:145,width:13,height:73),radius:6.5,pivot:CGPoint(x:left ? 167 : 312,y:181))
            let accent = shape(cushion,fill:orange)
            if !reduced {
                let breath = CABasicAnimation(keyPath:"opacity")
                breath.fromValue = 1; breath.toValue = 0.45; breath.duration = 1.6
                breath.autoreverses = true; breath.repeatCount = 2
                breath.timingFunction = CAMediaTimingFunction(controlPoints:0.77,0,0.175,1)
                accent.add(breath,forKey:"cushion")
            }
        }
    }

    private func spacing() {
        let start = CACurrentMediaTime()+0.96
        func move(_ layer: CALayer, _ key: String, from: CGFloat, to: CGFloat) {
            guard !reduced else { return }
            let animation = CABasicAnimation(keyPath:key)
            animation.fromValue = from; animation.toValue = to
            animation.duration = 2.24
            animation.beginTime = layer.convertTime(start,from:nil)
            animation.fillMode = .backwards
            animation.timingFunction = easeOut
            layer.add(animation,forKey:key)
        }
        for (i,letter) in ["T","E","N"].enumerated() {
            let x = CGFloat(176+64*i)
            let item = text(letter,point:64,center:CGPoint(x:x,y:140),color:orange)
            move(item,"position.x",from:x+CGFloat(i-1)*86,to:x)
        }
        for (name,show) in [("More space",false),("Less space",true)] {
            let label = text(name,point:20,center:CGPoint(x:240,y:202),color:ink.withAlphaComponent(0.7),weight:.regular)
            label.opacity = show ? 1 : 0
            if !reduced {
                let anim = CABasicAnimation(keyPath:"opacity")
                anim.fromValue = show ? 0 : 1; anim.toValue = show ? 1 : 0
                anim.duration = 0.08
                anim.beginTime = label.convertTime(start + (show ? 0.08 : 0),from:nil)
                anim.fillMode = .backwards
                label.add(anim,forKey:"spacing-caption")
            }
        }
    }
}
#endif
