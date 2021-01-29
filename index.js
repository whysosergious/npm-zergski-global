/**
 * Collect hooks, references and other needed data that can be accessed wherever it's imported.
 * Names, structure and methods are all still WIP. As this is the first iteration of the
 * the module.
 */
import { useEffect, useState } from 'react';

// global data, references, functions and hooks
export const globalObj = {};
globalObj.getOffsets = function(group) {
	Object.values(this[group]).forEach( e => e.getOffsetY());
}
// blueprint of method object that's copied and merged with the reference object
const globalObjMethods = {
	// ref offset getter
	getOffsetY() {
		this.offsetY = this.ref.offsetTop;
	},
	init( group, key, state, dispatch ) {		// initial method with hook assignment
		if ( this.ref ) {
			this.ref = this.ref.current; 	// element reference
			this.ref.zKey = key[0];
			this.ref.zEl = this;		// for easy pairing and execution of dispatch with observer ***check memory usage***
			this.getOffsetY();
		}
		this.state = state;		// component 'state'
		this.setState = dispatch;		// component hook 'setState'
	},
}

/**
 * Global assignment of custom hooks for individual elements
 * @param {React.ElementRef<HTMLElement>} objectEntry
 */
export const useGlobalObj = ( objectEntry, group = null) => {
	let key = Object.keys( objectEntry );
	const [ state, setState ] = useState(objectEntry[key].initialState || null);	// custom hook
	// when components mounts, we create their object entry
	// and initialize the object

	useEffect(() => {
		// we check if the group property is defined and if that group already exist in the global object
		globalObj[group || key] = globalObj[group] || {};

		Object.assign( objectEntry[key], globalObjMethods );
		objectEntry[key].init( group, key, state, setState );
		Object.assign( globalObj[group || key], group ? objectEntry : objectEntry[key]  );

	}, []);

	return [ state, setState ];
}


/**
 * Known issue **
 *
 * Currently a few component references are not initialized when root is mounted.
 * Requiring recalculation of element offsets. And while we can get them every time directly from the
 * references, those are reads we can spare the browser.
 * We can otherwise get them individually once at the start, and then on known changes.
 */



 /**
  * ********	Observer & async raf
  * ****************************************************************
  */
  /**
 * Intersection Observer and async raf. Needs cleanup and documentation.
 */

let rafTick = false;
const rafQueue = [];
/**
 * Execute a function or method (or set a state)
 * TODO!: Creating a queue array that removes duplicate or unneeded action and executes
 * the rest in order
 * @param {Function} action
 */
export const queueFrame = action => {
	action = typeof action !== 'function' ? (() => action) : action;	// we need a function
	rafQueue.push(action);	// add to queue

	const nextRequest = () => {
		let count = rafQueue.length;
		return new Promise(( res, rej ) => {
			window.requestAnimationFrame(() => {
				for ( let i=0; i<count; i++ ) {
					rafQueue[i]();
				}
				rafQueue.splice(0, count);
				res('done');
			});
		});
	}
	const raf = async () => {
		await nextRequest().then(v => {
			rafQueue.length > 0 ? raf() : rafTick = false;;
		});
	};

	if (!rafTick) {
		raf();
		rafTick = true;
	}
}

// Object for separation of target values
globalObj.Observers = {};
class TargetClass {
	constructor( target, handler ) {
		this.prevRatio = 1.0;
		this.elRef = target;
		this.handler = handler;
	}
}

/**
 * handy little function for defining different levels of thresholds
 * returns an int array
 * @param {BigInt} steps
 */
const buildThresholdList = ( steps ) => {
	let thresholds = [];
	let numSteps = steps;

	for (let i=1.0; i<=numSteps; i++) {
		let ratio = i/numSteps;
		thresholds.push(ratio);
	}

	thresholds.push(0);
	return thresholds;
}

function observeElement( targets ) {
	// creating separate object for each target
	let targetsArray = Array.isArray( targets ) ? targets : [ targets ];
	targetsArray.forEach( tgt => {
		this.observe( tgt );
		this.ObserverTargets[tgt.zKey] = new TargetClass( tgt, this.handler );
	});
}

// intersection observer
export const createObserver = ( name, root, targets, handler, rootMargin=['0px 0px 0px 0px'], thresholdSteps=20, delay=0, originalHandler=false ) => {
	let observer;

	let ModuleOptions = {
		delay: delay,
		root: root,
		rootMargin: rootMargin,
		threshold: buildThresholdList(thresholdSteps),
	};

	/**
	 * Shortening syntax and adding values
	 * has a callback pointing toward the assigned handler
	 * @param {*} entries
	 * @param {*} observer
	 */
	const ModuleHandleIntersect = ( entries, observer ) => {
		entries.forEach( entry => {
			let { zKey } = entry.target;
			let prevRatio = observer.ObserverTargets[zKey].prevRatio;

			observer.ObserverTargets[zKey].prevRatio = entry.intersectionRatio;
			return observer.ObserverTargets[zKey].handler({ entry, observer, zKey, prevRatio, entries });
		});
	}

	observer = new IntersectionObserver( originalHandler ? handler : ModuleHandleIntersect , ModuleOptions );

	observer.handler = handler;
	observer.ObserverTargets = {};
	observer.observeElement = observeElement;
	observer.observeElement( targets );

	globalObj.Observers[name] = observer;
}


/**
 * NOTES **
 *
 * target.classList.add('stuck');
 * isInViewCol[zKey].set(true);	// hooks were less performant by almost half( 653ms in just scripting )
 * of course refs should be used sparingly. But mixing css & js animation seems to work great!
 * plus, intersectionObserver completely eliminates the need to handle event listeners..
 * Not that event listeners don't have their use anymore.
 */



 /**
  * queueFrame() executes passed function or sets value asynchronously through a raf.
  * Queueing actions in array until they are run or applied. Though I need to find a different
  * way of triggering css as using custom hooks doesn't yield a lot because hooks are in
  * themselves asynchronous.
  * Recorded a 55% performance boost when triggering through 'ref.classList'.
  * ( 1057ms in only scripting, hard to compare to previous benchmarks though as the
  * workload was significantly different )
  * While refs are imperative, most React animation libraries use them and as previously stated
  * references are required for the use of 'intersectionObserver'.
  * The important thing to keep in mind is, when using classes, that changes are reset
  * when components rerender.
  * Which has many workarounds.
  */