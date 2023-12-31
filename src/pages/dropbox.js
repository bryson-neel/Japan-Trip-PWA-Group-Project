/* 
 * Shane Purdy
 * Bryson Neel
 * 
 * Open source icon retrieved from https://tablericons.com/ 
 */

import React, { useCallback, useState } from "react";
import { useDropzone } from 'react-dropzone';
import Cookies from "js-cookie";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { arrayUnion, getFirestore, updateDoc, addDoc, getDocs,collection, serverTimestamp, doc, deleteDoc, orderBy, query, enableIndexedDbPersistence, getDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, uploadBytes, ref, deleteObject } from 'firebase/storage';

// Initialize Firebase
const firebaseConfig =
{
	apiKey: "AIzaSyDWkmItJirMLZ9MotrBuJ_GthRl24cMxO4",
	authDomain: "uta-travel-abroad.firebaseapp.com",
	databaseURL: "https://uta-travel-abroad-default-rtdb.firebaseio.com",
	projectId: "uta-travel-abroad",
	storageBucket: "uta-travel-abroad.appspot.com",
	messagingSenderId: "1097972700841",
	appId: "1:1097972700841:web:bc6d8ab59aff357dc53bb8",
	measurementId: "G-SGP45GK6DJ"
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const analytics = getAnalytics(app);
const db = getFirestore();
const storage = getStorage();

// Enable db persistence so that Firestore files can be cached and
//   accessed offline
enableIndexedDbPersistence(db)
	.catch((err) =>
	{
		if (err.code == 'failed-precondition')
		{
			// Multiple tabs open, persistence can only be enabled
			//   in one tab at a time.
		}
		else if (err.code == 'unimplemented')
		{
			// The current browser does not support all of the
			//   features required to enable persistence
		}
	});

sessionStorage.setItem('_getImagesBool', 'T');

// Gets the codes from the Firestore database
//   If adminB is true, return the admin code; otherwise, return
//   the regular code
async function getCodes(adminB)
{
	// Query to retrieve the codes from the database
	const q = query(collection(db, "codes"));
	const querySnapshot = await getDocs(q);
	var retval = null;
	querySnapshot.forEach((doc) =>
	{
		if (adminB)
		{
			retval = doc.data().admin;
		}
		else
		{
			retval = doc.data().regular;
		}
	});
	return retval;
}


const Dropbox = () =>
{
	const [selectedImages, setSelectedImages] = useState([]);

	const uploadPost = async () =>
	{
		if (selectedImages === null)
		{
			alert('No files uploaded (png/jpg only)');
		}
		else if (selectedImages.length < 1)
		{
			alert('No files uploaded (png/jpg only)');
		}
		else
		{
			const captionElem = document.getElementById('caption');
			var capVal = '';
			if (captionElem !== null)
			{
				if (typeof captionElem.value === 'string')
				{
					capVal = captionElem.value;
				}
			}
			// Add a new document into the 'posts' collection using a caption entered by the user
			//   and the current timestamp
			const docRef = await addDoc(collection(db, 'posts'),
				{
					caption: capVal,
					timestamp: serverTimestamp()
				});
			// For each image the user uploaded, add it to the FireBase storage and include the
			//   urls in the new 'posts' document
			await Promise.all(
				selectedImages.map(image =>
				{
					const imageRef = ref(storage, `posts/${image.path}`);
					// Upload the image to the Firebase storage
					uploadBytes(imageRef, image, 'data_url').then(async () =>
					{
						// Add the download URLs to the new 'posts' document
						const downloadURL = await getDownloadURL(imageRef);
						await updateDoc(doc(db, 'posts', docRef.id),
							{
								images: arrayUnion(downloadURL)
							});
					});
				})
			)
			// Reset the 'caption' element and SelectedImages to empty and the 'dropzone_text'
			//   element to its default value
			if (captionElem !== null)
			{
				if (typeof captionElem.value === 'string')
				{
					captionElem.value = '';
				}
			}
			setSelectedImages([]);
			if (document.getElementById('dropzone_text') !== null)
			{
				document.getElementById('dropzone_text').innerHTML = 'Tap, click, or drag and drop to upload images';
			}
			// Let the user know how many images were uploaded and that the page will refresh
			alert(`${selectedImages.length} image(s) uploaded. Page will automatically refresh in 8 seconds.`);
			setTimeout(function ()
			{
				window.location.reload();
			}, 8000);
		}
		const pendingFilesElem = document.getElementById('pending_files');
		if (pendingFilesElem !== null)
		{
			while (pendingFilesElem.lastElementChild !== null)
			{
				pendingFilesElem.removeChild(pendingFilesElem.lastElementChild);
			}
		}
	}

	const onDrop = useCallback(acceptedFiles =>
	{
		// Let the user know how many files are pending for upload
		const numFilesPending = acceptedFiles.length;
		const pendingFilesElem = document.getElementById('pending_files');
		if (pendingFilesElem !== null)
		{
			while (pendingFilesElem.lastElementChild !== null)
			{
				pendingFilesElem.removeChild(pendingFilesElem.lastElementChild);
			}
		}
		// Show files pending
		acceptedFiles.forEach((image) =>
		{
			// Show the images pending for upload
			var img = document.createElement('img');
			img.src = URL.createObjectURL(image);
			if (pendingFilesElem !== null)
			{
				pendingFilesElem.appendChild(img);
			}
		});
		if (pendingFilesElem !== null)
		{
			pendingFilesElem.style.opacity = 0.3;
			pendingFilesElem.style.filter = 'alpha(opacity=30)';
		}
		if (document.getElementById('dropzone_text') !== null)
		{
			document.getElementById('dropzone_text').innerHTML = numFilesPending + ' file(s) pending <br /> Tap submit to upload them';
		}
		setSelectedImages(acceptedFiles.map(file =>
			Object.assign(file,
				{
					preview: URL.createObjectURL(file)
				})
		));
	}, []);

	// When the user interacts with the Dropzone element
	const { getRootProps, getInputProps } = useDropzone(
		{
			// Only accept png and jpg image files
			accept:
			{
				'image/png': ['.png'],
				'text/jpg': ['.jpg']
			},
			// Users can't upload more than 20 MB at a time
			maxSize: 20000000,
			// Function that handles what happens after
			onDrop
		});

	// Gets the images from the FireBase storage to display to the user
	async function getImages()
	{
		// Query to retrieve the images from the database
		const q = query(collection(db, "posts"), orderBy(`images`));
		const querySnapshot = await getDocs(q);
		var imagesElem = document.getElementById('images_display');

		// Display each image from the query
		querySnapshot.forEach((doc) =>
		{
			if (imagesElem !== null)
			{
				var verticalSpace = document.createElement('Text');
				verticalSpace.innerHTML = '<br />';

				doc.data().images.forEach((im) =>
				{
					let img = document.createElement('img');
					img.src = im;
					imagesElem.appendChild(img);
				});

				var caption = document.createElement('div');
				caption.innerHTML = doc.data().caption;

				// Create the delete button and include the post's id in
				//   the button's id
				var deleteButton = document.createElement('button');
				deleteButton.innerHTML = 'Delete';
				deleteButton.color = '#dc1518';
				deleteButton.id = `delete_button_${doc.id}`;

				imagesElem.appendChild(caption);
				imagesElem.appendChild(verticalSpace);
				imagesElem.appendChild(deleteButton);
				imagesElem.appendChild(verticalSpace);
				imagesElem.appendChild(verticalSpace);
				imagesElem.appendChild(verticalSpace);
			}
		});

		// Add a click listener to the document that handles deleting files from the
		//   Dropbox
		if (imagesElem !== null)
		{
			imagesElem.addEventListener('click', function (e)
			{
				// Only admins are allowed to delete files
				if (sessionStorage.getItem('_userLevel') === '2')
				{
					// Check to make sure the button clicked was one of the delete buttons
					//if(e.target && e.target.id.substring(0, 14) == 'delete_button_')
					if (e.target && (e.target.id).includes('delete_button_'));
					{
						// The id of the post to delete is the part of the button id after
						//   'delete_button_'
						// Ex: 'delete_button_n35f02fhjo954d3'
						const idToDelete = e.target.id.substring(14, String(e.target.id).length);

						// Check if an id was obtained
						if (typeof idToDelete === 'string')
						{
							if (idToDelete !== 'undefined' && idToDelete.length > 16)
							{
								// Get the document reference from Firestore using the id
								const docRef = doc(db, "posts", idToDelete);
								// Becomes false if an image wasn't deleted
								var successBool = true;
								//const d = await getDoc(docRef);
								// Get the image reference from storage, and delete that image
								getDoc(docRef).then((snapshot) =>
								{
									if (snapshot && snapshot.data() && snapshot.data().images && (snapshot.data().images).length > 0)
									{
										snapshot.data().images.forEach((im) =>
										{
											const imageRef = ref(storage, im);
											deleteObject(imageRef).then(() =>
											{
												// Delete was successful
											}).error((error) =>
											{
												// Delete was unsuccessful, so set successBool to false
												successBool = false;
											});
										});
									}

								});
								// If successBool is true, then every deletion was successful
								if (successBool)
								{
									// Delete the 'posts' document
									deleteDoc(docRef);
									// Let the user know that the page will refresh
									alert('Image(s) successfully deleted. Page will automatically refresh in 8 seconds.');
									setTimeout(function ()
									{
										window.location.reload();
									}, 8000);
								}
								// If successBool is false, then not every deletion was successful
								else
								{
									alert('Delete unsuccessful');
								}
							}
						}
					}
				}
				else
				{
					alert('Must be logged in with admin code to delete files');
				}
			});
		}
	}

	// Checks if the user entered the correct code
	async function check_code()
	{
		var wrongCodeElem = document.getElementById("wrong_code");

		if (navigator.onLine)
		{
			if (wrongCodeElem !== null)
			{
				wrongCodeElem.innerHTML = 'Checking code...';
			}
			const adminCode = await getCodes(true);
			const regularCode = await getCodes(false);

			var fromCookieOnly = false;

			var codeElem = document.getElementById("code");
			var codeInput = document.getElementById("code").value;
			if (codeElem !== null)
			{
				if (typeof codeInput !== 'string')
				{
					fromCookieOnly = true;
				}
			}

			// If the code only needs to be checked from the cookie file, then you don't
			//   need to do this part
			if (!fromCookieOnly)
			{
				// If getCodes() returns non-strings for both codes, then that means there 
				//   aren't any codes in the database (very bad if this occurs because the
				//   itinerary and dropbox will be inaccessible)
				if (typeof adminCode !== 'string' && typeof regularCode !== 'string')  // changed from number to string
				{
					if (wrongCodeElem !== null)
					{
						wrongCodeElem.innerHTML = 'Can\'t verify code (couldn\'t retrieve from database)';
						/*setTimeout(function ()
						{
							if (wrongCodeElem !== null)
							{
								wrongCodeElem.innerHTML = "";
							}
						}, 3000);*/
					}
				}
				else
				{
					if (codeInput === adminCode)
					{
						// If they entered the correct admin code, set the cookie so that
						//   they remain logged in
						Cookies.set("admin", adminCode,
							{
								expires: 100,
								secure: true,
								path: "/",
							});
					}
					else if (codeInput === regularCode)
					{
						// If they entered the correct regular code, set the cookie so that
						//   they remain logged in
						Cookies.set("regular", regularCode,
							{
								expires: 100,
								secure: true,
								path: "/",
							});
					}
					// Otherwise, the user will see the text 'Wrong code' if they aren't logged in
					else
					{
						if (!((sessionStorage.getItem('_userLevel') === '2') || (sessionStorage.getItem('_userLevel') === '1')))
						{
							if (wrongCodeElem !== null)
							{
								wrongCodeElem.innerHTML = 'Wrong code';
								/*setTimeout(function ()
								{
									if (wrongCodeElem !== null)
									{
										wrongCodeElem.innerHTML = '';
									}
								}, 2000);*/
							}
						}
						
					}
				}
			}  // (end of if (!fromCookieOnly))

			// Check the code from the cookie file, and set the userLevel accordingly
			if (Cookies.get('admin') == adminCode)
			{
				// sessionStorage variables persist even after the page is refreshed
				sessionStorage.setItem('_userLevel', '2');
				// Refresh the page
				window.location.reload();
			}
			else if (Cookies.get('regular') == regularCode)
			{
				sessionStorage.setItem('_userLevel', '1');
				// Refresh the page
				window.location.reload();
			}
			else
			{
				sessionStorage.setItem('_userLevel', '0');
				// Refresh the page
				window.location.reload();
			}
		}
		else
		{
			if (wrongCodeElem !== null)
			{
				// Let the user know that the code couldn't be verified
				wrongCodeElem.innerHTML = "Code can\'t be verified offline";
				/*setTimeout(function ()
				{
					if (wrongCodeElem !== null)
					{
						wrongCodeElem.innerHTML = '';
					}
				}, 2800);*/
			}
		}
	}

	// Display admin view if the user has the correct value for the admin cookie
	if (sessionStorage.getItem('_userLevel') === '2')
	{
		if (sessionStorage.getItem('_getImagesBool') === 'T')
		{
			sessionStorage.setItem('_getImagesBool', 'F');
			setTimeout(function ()
			{
				getImages();
			}, 1000);
		}
		const q = query(collection(db, "posts"));
		return (
			<div>
				{/* File upload */}
				<div>
					<div {...getRootProps()}>
						<input {...getInputProps()} />
						{/* Display the upload icon */}
						<svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-upload" width="100" height="100" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
							<path stroke="none" d="M0 0h24v24H0z" fill="none" />
							<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
							<polyline points="7 9 12 4 17 9" />
							<line x1="12" y1="4" x2="12" y2="16" />
						</svg>
						<p id='dropzone_text'>Tap, click, or drag and drop to upload images</p>
					</div>
					<div>
						{/* image(s) to be uploaded */}
						<span id="pending_files"></span>
					</div>
					<input id='caption' type="text" placeholder='optional caption' />
					<button onClick={uploadPost}>Submit</button>
				</div>
				<div>
					{/* Where the images and captions from the database are displayed */}
					<ul id='images_display' style={{ listStyleType: "none" }}></ul>
				</div>
			</div>
		);
	}
	// Display regular view if the user has the correct value for the regular cookie
	else if (sessionStorage.getItem('_userLevel') === '1')
	{
		if (sessionStorage.getItem('_getImagesBool') === 'T')
		{
			sessionStorage.setItem('_getImagesBool', 'F');
			setTimeout(function ()
			{
				getImages();
			}, 1000);
		}
		return (
			<div>
				<label style={{ fontSize: 14 }}>
					Enter admin code to delete images:&nbsp;
				</label>
				<input type="password" id="code" />
				<button onClick={check_code} type="button">
					Submit
				</button>
				<p id="wrong_code"></p>
				{/* File upload */}
				<div>
					<div {...getRootProps()}>
						<input {...getInputProps()} />
						{/* Display the upload icon */}
						<svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-upload" width="100" height="100" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
							<path stroke="none" d="M0 0h24v24H0z" fill="none" />
							<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
							<polyline points="7 9 12 4 17 9" />
							<line x1="12" y1="4" x2="12" y2="16" />
						</svg>
						<p id='dropzone_text'>Tap, click, or drag and drop to upload images</p>
					</div>
					<div>
						{/* image(s) to be uploaded */}
						<span id="pending_files"></span>
					</div>
					<input id='caption' type="text" placeholder='optional caption' />
					<button onClick={uploadPost}>Submit</button>
					{/* image(s) to be uploaded */}
				</div>
				<div>
					{/* Where the images and captions from the database are displayed */}
					<ul id='images_display' style={{ listStyleType: "none" }}></ul>
				</div>
			</div>
		);
	}
	// If the user isn't logged in at all, display the code insertion box and button
	else
	{
		return (
			<div>
				<label style={{ fontSize: 14 }}>
					Enter code provided by professor to access the dropbox:&nbsp;
				</label>
				<input type="password" id="code" />
				<button onClick={check_code} type="button">
					Submit
				</button>
				<label style={{ fontSize: 14 }}>
					Tap button without entering anything if you already logged in
				</label>
				<p id="wrong_code"></p>
			</div>
		);
	}
};

export default Dropbox;
