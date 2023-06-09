// temporary file to be replaced with a DB of users

import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import sgMail = require('@sendgrid/mail');
import { Pagination, PaginationOptionsInterface } from '../paginate';
import * as bcrypt from 'bcrypt';

//export type User = any;

@Injectable()
export class UsersService {

  public constructor(@InjectRepository(User)
  private usersRepository: Repository<User>
  ) {

  }


  async findAll(): Promise<User[]> {

    let userList = await this.usersRepository.find();

    return userList;
  }

  async findAllPaginate(
    options: PaginationOptionsInterface,
  ): Promise<Pagination<User>> {
    const take = options.take
    const skip = options.skip
    //const keyword = query.keyword || ''

    const [results, total] = await this.usersRepository.findAndCount(
      {
        take: take,
        skip: skip
      }
    );

    return new Pagination<User>({
      results,
      total,
      take,
      skip
    });
  }

  async findOne(email: string): Promise<User | undefined> {


    let userObj = await this.usersRepository.findOneOrFail({ where: { email: email } });

    return userObj;
  }

  // probably won't be used
  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async create(user: User) {


    // ----- reject if required fields are missing
    if (!user.email || !user.password) {

      throw new HttpException('Please provide all requested user information', HttpStatus.BAD_REQUEST);
    }

    //TODO: check if email is valid

    // check if user already exists
    const userInDb = await this.usersRepository.findOne({ where: { email: user.email } });
    if (userInDb) {
      throw new HttpException('User with that email already exists, please log in with that account', HttpStatus.BAD_REQUEST);
    }

    //hash password
    bcrypt.hash(user.password, 10, async (err, hash) => {
      if (err) {

        return new HttpException('Problem hashing password', HttpStatus.BAD_REQUEST);
      } else {
        user.password = hash;

        // set read and access statuses
        user.status = 'Pending';
        user.role = 'Read';

        // save user in db
        try {
          const result = await this.usersRepository.insert(user);

          // notify account that a new user has registered
          sgMail.setApiKey(process.env.SENDGRID_API_KEY)
          const msg = {
            to: 'Michelle.Thursby@newcastle.ac.uk', 
            from: 'rseteam.ncl@gmail.com', // change to the @newcastle one soon
            subject: 'New QUOD portal user registration',
            html: '<p>A new user has registered for the QUOD portal. You can approve users here:</p><a href=quodstorage.z33.web.core.windows.net/#/admin/users>quodstorage.z33.web.core.windows.net/#/admin/users</a>',
          }
          sgMail
            .send(msg)
            .then(() => {
              console.log('Email sent')
            })
            .catch((error) => {
              console.error(error)
            })
    

          return result;
        } catch (error) {
          throw new HttpException(error, HttpStatus.BAD_REQUEST);
        }
      }


    });

  }

  async update(user: User) {

    // check if user already exists
    const userInDb = await this.usersRepository.findOne({ where: { email: user.email } });
    const userID = userInDb.user_id;
    if (!userInDb) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.usersRepository.update(userID, user);
    } catch (error) {
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }

  }

  

  async reset(resetUser) {

    // ----- reject if required fields are missing
    if (!resetUser.email || !resetUser.token || !resetUser.password) {

      throw new HttpException('Please provide all requested information', HttpStatus.BAD_REQUEST);
    }


    // check if user already exists
    const userInDb = await this.usersRepository.findOne({ where: { email: resetUser.email } });
    if (!userInDb) {
      throw new HttpException('No User with that email exists', HttpStatus.BAD_REQUEST);
    }

    // check tokens save to DB matches token entered by user
    if (userInDb.password == resetUser.token) {

      //hash password
      bcrypt.hash(resetUser.password, 10, async (err, hash) => {
        if (err) {

          return new HttpException('Problem hashing password', HttpStatus.BAD_REQUEST);
        } else {
          userInDb.password = hash;

          // save user in db
          try {
            return await this.usersRepository.update(userInDb.user_id, userInDb);
          } catch (error) {
            throw new HttpException(error, HttpStatus.BAD_REQUEST);
          }
        }


      });

    } else return new HttpException('Token entered does not match that sent', HttpStatus.BAD_REQUEST);

  }

  async updateStatus(id: number, status: string) {


    const userInDb = await this.usersRepository.findOne({ where: { user_id: id } });
    if (!userInDb) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.usersRepository.update(id, { status: status });
    } catch (error) {
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }

  }

  async updateRole(id: number, role: string) {


    const userInDb = await this.usersRepository.findOne({ where: { user_id: id } });
    if (!userInDb) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.usersRepository.update(id, { role: role });
    } catch (error) {
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }

  }

}