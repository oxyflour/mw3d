declare module 'mmd-parser' {
	type number2 = [number, number]
	type number3 = [number, number, number]
	type number4 = [number, number, number, number]
	export type Pmd = {
		metadata: {
			boneCount: number
			boneFrameCount: number
			boneFrameNameCount: number
			comment: string
			constraintCount: number
			coordinateSystem: string
			englishComment: string
			englishCompatibility: number
			englishModelName: string
			faceCount: number
			format: string
			ikCount: number
			magic: string
			materialCount: number
			modelName: string
			morphCount: number
			morphFrameCount: number
			rigidBodyCount: number
			version: number
			vertexCount: number
		}
		boneFrameNames: {
			name: string
		}[]
		boneFrames: {
			boneIndex: number
			frameIndex: number
		}[]
		englishBoneFrameNames: {
			name: string
		}[]
		englishBoneFrames: {
			boneIndex: number
			frameIndex: number
		}[]
		englishMorphNames: {
			name: string
		}[]
		morphFrames: {
			index: number
		}[]
		bones: {
			name: string
			ikIndex: number
			parentIndex: number
			position: number3
			tailIndex: number
			type: number
		}[]
		constraints: {
			name: string
			position: number3
			rigidBodyIndex1: number
			rigidBodyIndex2: number
			rotation: number3
			springPosition: number3
			springRotation: number3
			rotationLimitation1: number3
			rotationLimitation2: number3
			translationLimitation1: number3
			translationLimitation2: number3
		}[]
		faces: {
			indices: number3
		}[]
		iks: {
			effector: number
			iteration: number
			linkCount: 3
			links: { index: number }[]
			maxAngle: number
			target: number
		}[]
		materials: {
			ambient: number3
			diffuse: number4
			edgeFlag: number
			faceCount: number
			fileName: string
			shininess: number
			specular: number3
			toonIndex: number
		}[]
		morphs: {
			name: string
			type: number
			elementCount: number
			elements: {
				index: number
				position: number3
			}[]
		}[]
		rigidBodies: {
			name: string
			type: number
			boneIndex: number
			shapeType: number
			weight: number

			width: number
			height: number
			depth: number

			friction: number
			groupIndex: number
			groupTarget: number
			position: number3
			positionDamping: number
			restitution: number
			rotation: number3
			rotationDamping: number
		}[]
		toonTextures: {
			fileName: string
		}[]
		vertices: {
			edgeFlag: number
			normal: number3
			position: number3
			skinIndices: number2
			skinWeights: number2
			uv: number2
		}[]
	}
	export type Vmd = {
		metadata: {
			cameraCount: 0
			coordinateSystem: string
			magic: string
			morphCount: number
			motionCount: number
			name: string
		}
		cameras: {
		}[]
		morphs: {
			morphName: string
			frameNum: number
			weight: number
		}[]
		motions: {
			boneName: string
			frameNum: number
			interpolation: number[]
			position: number3
			rotation: number4
		}[]
	}
	class Parser {
		parsePmd(buffer: ArrayBuffer): Pmd
		parseVmd(buffer: ArrayBuffer): Vmd
		parsePmx(buffer: ArrayBuffer): Pmd
	}
}
