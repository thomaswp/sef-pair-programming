import { Blocks, Events, Extension, Snap } from 'sef';
import { IO } from './PairProgramming';

export class PairProgramming extends Extension {

    init() {
        console.log('loaded');
    }
}

const pp = new PairProgramming();
pp.register();

export {
    IO,
}



