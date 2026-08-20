# Of Armies And Hordes army builder

Static Angular app for building legal *Of Armies And Hordes* army lists.

## Run

```bash
npm start
```

Open `http://localhost:4200/`.

## Data

Unit profiles are generated from `docs/oaah-builder version 4_1.ods · versie 1 - Units.csv`:

```bash
npm run parse-units
```

Army lists are stored in browser local storage.

## Build

```bash
npm run build
```

The static site is written to `dist/oaah-armybuilder`.
