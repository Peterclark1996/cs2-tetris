/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { Color, createEntity, game, runServerCommand, Vector } from "s2ts/counter-strike"

Instance.Msg("Starting Tetris")

const cellSize = 33
const worldOrigin = Vector(0, -32, 0)

let currentGrid = Array.from({ length: 12 }, () => Array.from({ length: 22 }, () => -1))
let colorForId: Color[] = []
let ticksBetweenTickDowns = 6
let ticksUntilNextTickDown = ticksBetweenTickDowns
let currentShapeState: ShapeState | undefined = undefined
let nextShapeId = 1
let movementNextThink: "left" | "right" | "down" | "rotate" | undefined = undefined
let score = 0

let gameRunning = false

const spawnTile = (origin: { x: number; y: number }, id: number, color: Color, placeCrateProp: boolean = true) => {
    currentGrid[origin.x][origin.y] = id

    colorForId[id] = color

    if (!placeCrateProp) {
        return
    }

    createEntity({
        class: "prop_dynamic",
        keyValues: {
            targetName: `crate${id}`,
            origin: Vector.add({ x: origin.x * cellSize, y: origin.y * cellSize, z: 0 }, worldOrigin),
            model: "models/props/de_dust/hr_dust/dust_crates/dust_crate_style_01_32x32x32.vmdl",
            renderAmount: 255,
            renderColor: color,
            solid: "bbox"
        }
    })
}

const killTile = (id: number) => {
    Instance.EntFireAtName(`crate${id}`, "Kill", "", 0)

    for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 22; y++) {
            if (currentGrid[x][y] === id) {
                currentGrid[x][y] = -1
            }
        }
    }
}

const explodeTile = (origin: { x: number; y: number }, extraDelay: number) => {
    const targetname = "explode_" + Math.random().toString(36).substring(7)
    createEntity({
        class: "env_explosion",
        keyValues: {
            targetName: targetname,
            origin: { x: origin.x * cellSize, y: origin.y * cellSize, z: 40 },
            magnitude: 100,
            sound: "BaseGrenade.Explode"
        }
    })

    game.runAfterDelaySeconds(() => runServerCommand(`ent_fire ${targetname} explode`), 0.1 + extraDelay)
}

Instance.InitialActivate(() => {
    runServerCommand("mp_roundtime 60")
    runServerCommand("mp_freezetime 1")
    runServerCommand("mp_team_intro_time 0")
    runServerCommand("sv_infinite_ammo 1")
    runServerCommand("cl_drawhud 0")
    runServerCommand("mp_force_pick_time 0")
    runServerCommand("cl_lock_camera 0")
    runServerCommand("sv_accelerate 100")
    runServerCommand("sv_maxspeed 50")
    runServerCommand("sv_friction 100")
})

game.on("round_start", () => {
    gameRunning = false
    runServerCommand("cl_lock_camera 0")

    const spawnPoint = Vector(138, 309, 625)
    const commonKvs = {
        message: "Shoot to start!",
        color: Color.white,
        fontSize: 500,
        justifyHorizontal: "center",
        justifyVertical: "center"
    } as const

    createEntity({
        class: "point_soundevent",
        keyValues: {
            targetName: "music",
            soundName: "music.tetris"
        },
        outputs: {
            onSoundFinished: () => {
                Instance.Msg("Music finished build in")
                Instance.EntFireAtName("music", "startsound")
            }
        }
    })

    createEntity({
        class: "point_worldtext",
        keyValues: {
            origin: Vector.add(spawnPoint, Vector(0, -600, 80)),
            angles: { x: 0, y: 180, z: 90 },
            ...commonKvs
        }
    })
    createEntity({
        class: "point_worldtext",
        keyValues: {
            origin: Vector.add(spawnPoint, Vector(0, 600, 80)),
            angles: { x: 0, y: 0, z: 90 },
            ...commonKvs
        }
    })
    createEntity({
        class: "point_worldtext",
        keyValues: {
            origin: Vector.add(spawnPoint, Vector(-600, 0, 80)),
            angles: { x: 0, y: 90, z: 90 },
            ...commonKvs
        }
    })
    createEntity({
        class: "point_worldtext",
        keyValues: {
            origin: Vector.add(spawnPoint, Vector(600, 0, 80)),
            angles: { x: 0, y: -90, z: 90 },
            ...commonKvs
        }
    })
})

game.on("weapon_fire", () => {
    runServerCommand("setang 90 -90 0")

    if (gameRunning) {
        for (let y = 0; y < 22; y++) {
            let row = ""
            for (let x = 0; x < 12; x++) {
                const cell = currentGrid[11 - x][y] === -1 ? "." : currentGrid[11 - x][y].toString()
                row += `[${cell === "0" ? "##" : cell.padStart(2, " ")}]`
            }
            Instance.Msg(row)
        }
        return
    }

    gameRunning = true

    Instance.EntFireAtName("music", "startsound")

    game.runNextTick(setupGame)
})

const setupGame = () => {
    currentGrid = Array.from({ length: 12 }, () => Array.from({ length: 22 }, () => -1))
    colorForId = []
    ticksBetweenTickDowns = 6
    ticksUntilNextTickDown = ticksBetweenTickDowns
    currentShapeState = undefined
    nextShapeId = 1
    movementNextThink = undefined
    score = 0

    runServerCommand("fov_cs_debug 80")
    runServerCommand("cl_lock_camera 1")
    runServerCommand("setpos 137 314 740")

    createEntity({
        class: "point_worldtext",
        keyValues: {
            origin: { x: -192, y: 240, z: 32 },
            angles: { x: 0, y: 180, z: 0 },
            message: "Score",
            color: Color.white,
            fontSize: 500,
            worldUnitsPerPixel: 0.25,
            justifyHorizontal: "center",
            justifyVertical: "center"
        }
    })

    createEntity({
        class: "point_worldtext",
        keyValues: {
            targetName: "score",
            origin: { x: -192, y: 304, z: 32 },
            angles: { x: 0, y: 180, z: 0 },
            message: "00000000",
            color: Color.white,
            fontSize: 500,
            justifyHorizontal: "center",
            justifyVertical: "center"
        }
    })

    for (let i = 0; i < 22; i++) {
        spawnTile({ x: 0, y: i }, 0, Color.grey)
        spawnTile({ x: 11, y: i }, 0, Color.grey)
    }

    for (let i = 0; i < 10; i++) {
        spawnTile({ x: i + 1, y: 0 }, 0, Color.grey)
        spawnTile({ x: i + 1, y: 21 }, 0, Color.grey)
    }
}

const Shapes = {
    I: Color.red,
    J: Color.green,
    L: Color.blue,
    O: Color.orange,
    S: Color.pink,
    T: Color.purple,
    Z: Color.yellow
} as const
type Shape = keyof typeof Shapes

type ShapeState = {
    id: number
    x: number
    y: number
    shape: Shape
    rotation: number
}

let actualGameTick = 0
game.onTick(() => {
    if (!gameRunning) {
        return
    }
    actualGameTick++

    // Arbitrary throttle
    if (actualGameTick % 6 !== 0) {
        return
    }

    runServerCommand("setang 90 -90 0")

    if (ticksUntilNextTickDown > 0) {
        ticksUntilNextTickDown--

        tickPlayerMove()
        return
    }

    tickDown()

    ticksUntilNextTickDown = ticksBetweenTickDowns
})

const tickPlayerMove = () => {
    if (currentShapeState === undefined || movementNextThink === undefined) {
        return
    }

    let nextShapeState: ShapeState | undefined = currentShapeState
    switch (movementNextThink) {
        case "left":
            nextShapeState = shiftedLeft(currentShapeState)
            break
        case "right":
            nextShapeState = shiftedRight(currentShapeState)
            break
        case "down":
            while (nextShapeState !== undefined) {
                const nextNextShapeState = shiftedDown(nextShapeState)

                if (nextNextShapeState === undefined) {
                    break
                }

                nextShapeState = nextNextShapeState
            }
            break
        case "rotate":
            nextShapeState = rotated(currentShapeState)
            break
    }

    if (nextShapeState === undefined) {
        movementNextThink = undefined
        return
    }

    unrenderShape(currentShapeState)

    if (movementNextThink === "down") {
        renderShape(nextShapeState, false)
        const foundFullRows = checkForFullRows()

        if (!foundFullRows) {
            for (let x = 0; x < 12; x++) {
                for (let y = 0; y < 22; y++) {
                    if ([nextShapeState.id, nextShapeState.id + 1, nextShapeState.id + 2, nextShapeState.id + 3].includes(currentGrid[x][y])) {
                        spawnTile({ x, y }, currentGrid[x][y], colorForId[currentGrid[x][y]])
                    }
                }
            }
        }

        currentShapeState = undefined
    } else {
        renderShape(nextShapeState)
        currentShapeState = nextShapeState
    }

    movementNextThink = undefined
}

Instance.PublicMethod("Left", () => {
    if (currentShapeState === undefined) {
        return
    }

    movementNextThink = "left"
})

Instance.PublicMethod("Right", () => {
    if (currentShapeState === undefined) {
        return
    }

    movementNextThink = "right"
})

Instance.PublicMethod("Down", () => {
    if (currentShapeState === undefined) {
        return
    }

    movementNextThink = "down"
})

Instance.PublicMethod("Up", () => {
    if (currentShapeState === undefined || currentShapeState.shape === "O") {
        return
    }

    movementNextThink = "rotate"
})

const pickRandomShape = (): Shape => {
    const shapes = Object.keys(Shapes) as Shape[]
    return shapes[Math.floor(Math.random() * shapes.length)]
}

const tickDown = () => {
    if (currentShapeState === undefined) {
        const nextShape = pickRandomShape()

        const shapesSpawned = nextShapeId / 4
        ticksBetweenTickDowns = Math.max(1, 6 - Math.floor(shapesSpawned / 15))

        currentShapeState = {
            id: nextShapeId,
            x: 5,
            y: shapeHeightSpawn[nextShape],
            shape: nextShape,
            rotation: 0
        }
        nextShapeId += 4

        if (!isLegalState(currentShapeState)) {
            renderShape(currentShapeState)
            gameRunning = false
            runServerCommand("kill")
            return
        }

        renderShape(currentShapeState)
        return
    }

    const nextShapeState = shiftedDown(currentShapeState)

    if (nextShapeState === undefined) {
        checkForFullRows()
        currentShapeState = undefined
        return
    }

    unrenderShape(currentShapeState)
    currentShapeState = nextShapeState
    renderShape(currentShapeState)
}

const shiftedLeft = (shapeState: ShapeState) => {
    const newShapeState = { ...shapeState, x: shapeState.x + 1 }
    if (isLegalState(newShapeState)) return newShapeState
}

const shiftedRight = (shapeState: ShapeState) => {
    const newShapeState = { ...shapeState, x: shapeState.x - 1 }
    if (isLegalState(newShapeState)) return newShapeState
}

const shiftedDown = (shapeState: ShapeState) => {
    const newShapeState = { ...shapeState, y: shapeState.y + 1 }
    if (isLegalState(newShapeState)) return newShapeState
}

const rotated = (shapeState: ShapeState) => {
    const newShapeState = { ...shapeState, rotation: shapeState.rotation + 1 }
    if (isLegalState(newShapeState)) return newShapeState
}

const isLegalState = (shapeState: ShapeState) => {
    const shape = ShapeDefinitions[shapeState.shape][shapeState.rotation % ShapeDefinitions[shapeState.shape].length]

    const allowedIds = [-1, shapeState.id, shapeState.id + 1, shapeState.id + 2, shapeState.id + 3]

    for (let i = 0; i < shape.length; i++) {
        const [dx, dy] = shape[i]
        const x = shapeState.x + dx
        const y = shapeState.y + dy

        if (x < 0 || x >= 12 || y < 0 || y >= 22) {
            return false
        }

        if (!allowedIds.includes(currentGrid[x][y])) {
            return false
        }
    }

    return true
}

const unrenderShape = (shapeState: ShapeState) => {
    for (let i = 0; i < 4; i++) {
        killTile(shapeState.id + i)
    }
}

const renderShape = (shapeState: ShapeState, placeCrateProp: boolean = true) => {
    const shape = ShapeDefinitions[shapeState.shape][shapeState.rotation % ShapeDefinitions[shapeState.shape].length]

    for (let i = 0; i < shape.length; i++) {
        const [dx, dy] = shape[i]
        const x = shapeState.x + dx
        const y = shapeState.y + dy

        spawnTile({ x, y }, shapeState.id + i, Shapes[shapeState.shape], placeCrateProp)
    }
}

const checkForFullRows = () => {
    const rowsToRemove: number[] = []

    for (let y = 1; y < 21; y++) {
        let isFullRow = true

        for (let x = 1; x < 11; x++) {
            if (currentGrid[x][y] === -1) {
                isFullRow = false
                break
            }
        }

        if (isFullRow) {
            rowsToRemove.push(y)
        }
    }

    if (rowsToRemove.length > 0) {
        removeRows(rowsToRemove)
    }

    return rowsToRemove.length > 0
}

const addScore = (rowsCleared: number) => {
    switch (rowsCleared) {
        case 1:
            score += 40
            break
        case 2:
            score += 100
            break
        case 3:
            score += 300
            break
        case 4:
            score += 1200
            break
    }

    Instance.EntFireAtName("score", "setmessage", score.toString().padStart(8, "0"))
}

const removeRows = (rowsToRemove: number[]) => {
    const rowsToRemoveSet = new Set(rowsToRemove)

    const shiftForRow = new Array(22).fill(0)
    let removedRowsBelow = 0
    let totalExplosions = 0

    for (let y = 21; y >= 1; y--) {
        if (rowsToRemoveSet.has(y)) {
            removedRowsBelow++
            for (let x = 1; x < 11; x++) {
                const id = currentGrid[x][y]
                if (id !== -1 && id !== 0) {
                    killTile(id)
                    currentGrid[x][y] = -1
                    explodeTile({ x, y }, totalExplosions * (1 / 32))
                    totalExplosions++
                }
            }
        } else {
            shiftForRow[y] = removedRowsBelow
        }
    }

    for (let y = 20; y >= 1; y--) {
        for (let x = 1; x < 11; x++) {
            const id = currentGrid[x][y]
            if (id !== -1 && id !== 0) {
                const shift = shiftForRow[y]
                if (shift > 0) {
                    const newY = y + shift
                    currentGrid[x][y] = -1
                    currentGrid[x][newY] = id

                    moveTile(x, y, x, newY, id)
                }
            }
        }
    }

    addScore(rowsToRemoveSet.size)
}

const moveTile = (oldX: number, oldY: number, newX: number, newY: number, id: number) => {
    currentGrid[oldX][oldY] = -1
    currentGrid[newX][newY] = id

    killTile(id)
    spawnTile({ x: newX, y: newY }, id, colorForId[id])
}

const shapeHeightSpawn = {
    I: 2,
    J: 1,
    L: 1,
    O: 1,
    S: 2,
    T: 1,
    Z: 1
} as const

const ShapeDefinitions: { [key in Shape]: number[][][] } = {
    I: [
        [
            [0, -1],
            [0, 0],
            [0, 1],
            [0, 2]
        ],
        [
            [-1, 0],
            [0, 0],
            [1, 0],
            [2, 0]
        ]
    ],
    J: [
        [
            [0, 0],
            [0, 1],
            [0, 2],
            [1, 2]
        ],
        [
            [0, 1],
            [1, 1],
            [2, 1],
            [2, 0]
        ],
        [
            [1, 0],
            [1, 1],
            [1, 2],
            [0, 0]
        ],
        [
            [0, 0],
            [0, 1],
            [1, 0],
            [2, 0]
        ]
    ],
    L: [
        [
            [1, 0],
            [1, 1],
            [1, 2],
            [0, 2]
        ],
        [
            [0, 1],
            [1, 1],
            [2, 1],
            [2, 2]
        ],
        [
            [0, 2],
            [0, 1],
            [0, 0],
            [1, 0]
        ],
        [
            [0, 1],
            [1, 1],
            [2, 1],
            [0, 0]
        ]
    ],
    O: [
        [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1]
        ]
    ],
    Z: [
        [
            [0, 0],
            [-1, 0],
            [-1, 1],
            [-2, 1]
        ],
        [
            [-1, 0],
            [-1, 1],
            [0, 1],
            [0, 2]
        ]
    ],
    T: [
        [
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1]
        ],
        [
            [1, 0],
            [1, 1],
            [1, 2],
            [0, 1]
        ],
        [
            [0, 1],
            [1, 1],
            [2, 1],
            [1, 2]
        ],
        [
            [1, 0],
            [1, 1],
            [1, 2],
            [2, 1]
        ]
    ],
    S: [
        [
            [0, 0],
            [-1, 0],
            [-1, -1],
            [-2, -1]
        ],
        [
            [-1, 0],
            [-1, -1],
            [0, -1],
            [0, -2]
        ]
    ]
}
