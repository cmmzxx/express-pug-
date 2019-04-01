let select = document.querySelector('.select')
let form = document.querySelector('.avatar-form')
let submit = document.querySelector('.submit')
let avatarEl = document.querySelector('.avatar-el')
select.onchange = function (e) {
  if (e.target.files[0]) {
    submit.click()
  }
}
form.onsubmit = async function (e) {
  e.preventDefault()
  let formdata = new FormData(form)
  let file = select.files[0]
  formdata.append(file, 'avatar')
  let res = await axios.post('/changeAvatar', formdata)
  if (res.data.code === 200) {
    alert(res.data.msg)
    avatarEl.src = '/avatars/' + res.data.avatar
  } else {
    alert(res.data.msg)
  }
}
